import { expect } from 'chai';
import { readFileSync } from 'fs';
import { RequestT, SignatureV4 } from '../lib';
import { Headers } from '../lib/headers';
import * as Helper from '../lib/helper';

type TestConfigT = {
    authz: string;
    creq: string;
    req: string;
    sreq: string;
    sts: string;
};

function configTest(path: string): TestConfigT {
    const tmp = path.split('/')[path.split('/').length - 1];

    const authz = readFileSync(`${path}/${tmp}.authz`).toString();
    const creq = readFileSync(`${path}/${tmp}.creq`).toString();
    const req = readFileSync(`${path}/${tmp}.req`).toString();
    const sreq = readFileSync(`${path}/${tmp}.sreq`).toString();
    const sts = readFileSync(`${path}/${tmp}.sts`).toString();
    return {
        authz,
        creq,
        req,
        sreq,
        sts,
    };
}

function parser(req: string): { method: string, protocol: string, host: string, path: string, headers: Headers, payload: string } {
    const headers = new Headers();
    const lineSplit = req.split('\n');

    const fstLine = lineSplit[0];
    const fstSplitted = fstLine.split(' ');

    const method = fstSplitted[0].trim();
    const protocol = fstSplitted[fstSplitted.length - 1];

    const path = fstSplitted.slice(1, fstSplitted.length - 1).join(' ').trim();

    const indexJustBeforePayload = lineSplit.lastIndexOf('') === -1 ? lineSplit.length : lineSplit.lastIndexOf('');

    lineSplit.slice(1, indexJustBeforePayload)
        .reduce((prev, curr) => {
            const currSplit = curr.trim().split(':');
            if (currSplit.length > 1) {
                const hName = currSplit[0];
                const hValue = currSplit.slice(1).join('');
                headers.append(hName, hValue.trim());

                return hName;
            } else {
                headers.append(prev, curr.trim());
                return prev;
            }
        }, '');

    const payload = lineSplit
        .slice(indexJustBeforePayload + 1)
        .reduce((acc, curr) => `${acc}${curr}`, '');

    const host = headers.get('Host') || '';

    return { method, protocol, host, path, headers, payload };
}

describe('AWS test suite (General cases)', () => {
    const testCases = [
        `${__dirname}/aws4_testsuite/get-header-key-duplicate`,
        `${__dirname}/aws4_testsuite/get-header-value-multiline`,
        `${__dirname}/aws4_testsuite/get-header-value-order`,
        `${__dirname}/aws4_testsuite/get-header-value-trim`,
        `${__dirname}/aws4_testsuite/get-unreserved`,
        `${__dirname}/aws4_testsuite/get-utf8`,
        `${__dirname}/aws4_testsuite/get-vanilla`,
        `${__dirname}/aws4_testsuite/get-vanilla-empty-query-key`,
        `${__dirname}/aws4_testsuite/get-vanilla-query`,
        `${__dirname}/aws4_testsuite/get-vanilla-query-order-key-case`,
        `${__dirname}/aws4_testsuite/get-vanilla-query-unreserved`,
        `${__dirname}/aws4_testsuite/get-vanilla-utf8-query`,
        `${__dirname}/aws4_testsuite/normalize-path/get-relative`,
        `${__dirname}/aws4_testsuite/normalize-path/get-relative-relative`,
        `${__dirname}/aws4_testsuite/normalize-path/get-slash`,
        `${__dirname}/aws4_testsuite/normalize-path/get-slash-dot-slash`,
        `${__dirname}/aws4_testsuite/normalize-path/get-slash-pointless-dot`,
        `${__dirname}/aws4_testsuite/normalize-path/get-slashes`,
        `${__dirname}/aws4_testsuite/normalize-path/get-space`,
        `${__dirname}/aws4_testsuite/post-header-key-case`,
        `${__dirname}/aws4_testsuite/post-header-key-sort`,
        `${__dirname}/aws4_testsuite/post-header-value-case`,
        `${__dirname}/aws4_testsuite/post-sts-token/post-sts-header-after`,
        `${__dirname}/aws4_testsuite/post-sts-token/post-sts-header-before`,
        `${__dirname}/aws4_testsuite/post-vanilla`,
        `${__dirname}/aws4_testsuite/post-vanilla-empty-query-value`,
        `${__dirname}/aws4_testsuite/post-vanilla-query`,
        // `${__dirname}/aws4_testsuite/post-vanilla-query-nonunreserved`,
        // `${__dirname}/aws4_testsuite/post-vanilla-query-space`,
        `${__dirname}/aws4_testsuite/post-x-www-form-urlencoded`,
        `${__dirname}/aws4_testsuite/post-x-www-form-urlencoded-parameters`,
    ];

    testCases.forEach(testCasePath => {
        const { authz, creq, req, sreq, sts } = configTest(testCasePath);
        const { method, protocol, host, path, headers, payload } = parser(req);

        let request: RequestT;
        if (method === 'GET') {
            request = {
                method: 'GET',
                url: `${protocol}://${host}${path}`,
                headers,
            };
        } else {
            request = {
                method: 'POST',
                url: `${protocol}://${host}${path}`,
                headers,
                payload,
            };
        }
        const signer = new SignatureV4(request, 'service', 'us-east-1');

        const accessKeyId = 'AKIDEXAMPLE';
        const secretAccessKey = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
        const sessionToken = 'AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQWLWsKWHGBuFqwAeMicRXmxfpSP'
            + 'fIeoIYRqTflfKD8YUuwthAx7mSEI/qkPpKPi/kMcGdQrmGdeehM4IC1NtBmUpp2wUE8phUZampKsburEDy0KPkyQDYwT7WZ0wq5VSXDvp75'
            + 'YU9HFvlRd8Tx6q6fE8YQcHNVXAkiY9q6d+xo0rKwT38xVqr7ZD0u0iPPkUL64lIZbqBAz+scqKmlzm8FDrypNC9Yjc8fPOLn9FX9KSYvKTr4'
            + 'rvx3iSIlTJabIQwj2ICCR/oLxBA==';

        const testCase = testCasePath.split('/')[testCasePath.split('/').length - 1];

        it(`${testCase} (canonical request)`, () => {
            expect(signer.createCanonicalRequest()).to.equal(creq);
        });

        it(`${testCase} (string to sign)`, () => {
            expect(signer.createStringToSign()).to.equal(sts);
        });

        it(`${testCase} (signing information)`, () => {
            expect(signer.createSignture(accessKeyId, secretAccessKey)).to.equal(authz);
        });

        it(`${testCase} (signed request)`, () => {
            const { 'headers': sHeaders } = parser(sreq);
            const sHeadersLen = sHeaders.keys().length;

            let iHeaders: Headers;
            let iHeadersLen: number;

            if (testCasePath === `${__dirname}/aws4_testsuite/post-sts-token/post-sts-header-after`) {
                iHeaders = signer.createHeaders(accessKeyId, secretAccessKey, sessionToken);
            } else {
                iHeaders = signer.createHeaders(accessKeyId, secretAccessKey);
            }
            iHeadersLen = iHeaders.keys().length;
            expect(iHeadersLen).to.equal(iHeadersLen);

            iHeaders.forEach((values, name) => {
                expect(true).to.equal(sHeaders.has(name));
                expect(values.join(',')).to.equal((sHeaders.getAll(name) || []).join(',').trim());
            });
        });
    });
});

describe('Helper functions:', () => {
    describe('getXAmzDate', () => {
        const date = new Date(Date.UTC(2015, 7, 30, 12, 36));
        it(`should able to return the date in string format 'YYYYMMDDTHHMMSSZ'`, () => {
            expect(Helper.getXAmzDate(date)).equal('20150830T123600Z');
        });
    });

    describe('urlDecomposition', () => {
        const date = new Date(Date.UTC(2015, 7, 30, 12, 36));
        it(`should able to decompose the given URL`, () => {
            const { protocol, host, path, pathname, query } = Helper.urlDecomposition('http://www.example.com/path1/path2?a=b&c=d');
            expect(protocol).equal('http');
            expect(host).equal('www.example.com');
            expect(path).equal('/path1/path2?a=b&c=d');
            expect(pathname).equal('/path1/path2');
            expect(query).equal('a=b&c=d');
        });

        it('should throw Error if the input URL is invalid', () => {
            const fn = () => {
                const { protocol, host, path, pathname, query } = Helper.urlDecomposition('http:/www.example.com/path1/path2?a=b&c=d');
            };

            expect(fn).to.throw(Error);
        });
    });

    describe('fixedEncodeURIComponent', () => {
        it(`more stringent in adhering to RFC 3986 (which reserves !, ', (, ), and *)`, () => {
            expect(Helper.fixedEncodeURIComponent(`!'()*`)).equal('%21%27%28%29%2a');
        });
    });

});
