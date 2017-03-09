import { enc, HmacSHA256, SHA256 } from 'crypto-js';
import { Headers } from './headers';
import * as Helper from './helper';

export { Headers };

export type GetT = { method: 'GET' };

export type PostT = { method: 'POST'; payload: string };

export type PutT = { method: 'PUT'; payload: string };

export type DeleteT = { method: 'DELETE'; payload: string };

export type HeadT = { method: 'HEAD'; payload: string };

export type OptionsT = { method: 'OPTIONS'; payload: string };

export type PatchT = { method: 'PATCH'; payload: string };

export type MethodT = GetT | PostT | PutT | DeleteT | HeadT | OptionsT | PatchT;

export type RequestT = MethodT & { url: string, headers: Headers };

export class SignatureV4 {

  private readonly method: string;
  private readonly host: string;
  private readonly pathname: string;
  private readonly query: string;
  private readonly headers = new Headers();
  private readonly payload: string;
  private readonly xAmzDate: string;

  constructor(
    request: RequestT,
    private readonly service: string,
    private readonly region: string,
  ) {
    // const { method, pathname, query, headers, payload } = Signer.parser(request.trim());
    const { host, pathname, query } = Helper.urlDecomposition(request.url);

    this.method = request.method;
    this.host = host;
    this.pathname = pathname;
    this.query = query;

    this.headers = request.headers;
    this.xAmzDate = this.headers.get('X-Amz-Date') || Helper.getXAmzDate(new Date());
    this.headers.set('Host', this.headers.get('Host') || this.host);
    this.headers.set('X-Amz-Date', this.xAmzDate);
    this.payload = request.method === 'GET' ? '' : request.payload;
  }

  createCanonicalRequest(): string {
    return this.buildHTTPRequestMethod() + '\n'
      + this.buildCanonicalURI() + '\n'
      + this.buildCanonicalQueryString() + '\n'
      + this.buildCanonicalHeaders() + '\n'
      + this.buildSignedHeaders() + '\n'
      + enc.Hex.stringify(SHA256(this.payload));
  }

  createStringToSign(): string {
    const yyyymmdd = this.xAmzDate.split('T')[0];
    return 'AWS4-HMAC-SHA256\n'
      + `${this.xAmzDate}\n`
      + `${yyyymmdd}/${encodeURIComponent(this.region)}/${encodeURIComponent(this.service)}/aws4_request\n`
      + enc.Hex.stringify(SHA256(this.createCanonicalRequest()));
  }

  createSignture(accessKeyId: string, secretAccessKey: string): string {
    const yyyymmdd = this.xAmzDate.split('T')[0];
    const signature = this.calculateSignature(secretAccessKey);

    return 'AWS4-HMAC-SHA256 '
      + `Credential=${accessKeyId}/${yyyymmdd}/${this.region}/${this.service}/aws4_request, `
      + `SignedHeaders=${this.buildSignedHeaders()}, `
      + `Signature=${signature}`;
  }

  createHeaders(accessKeyId: string, secretAccessKey: string, sessionToken?: string): Headers {
    const headers = new Headers(this.headers);
    headers.set('Host', this.host);
    headers.set('X-Amz-Date', this.xAmzDate);
    if (sessionToken) {
      headers.set('X-Amz-Security-Token', sessionToken);
    }
    headers.set('Authorization', this.createSignture(accessKeyId, secretAccessKey));
    return headers;
  }

  private calculateSignature(secretAccessKey: string): string {
    const yyyymmdd = this.xAmzDate.split('T')[0];
    const stringToSign = this.createStringToSign();
    const kDate = HmacSHA256(yyyymmdd, 'AWS4' + secretAccessKey);
    const kRegion = HmacSHA256(this.region, kDate);
    const kService = HmacSHA256(this.service, kRegion);
    const kSigning = HmacSHA256('aws4_request', kService);
    return enc.Hex.stringify(HmacSHA256(stringToSign, kSigning));
  }

  private buildHTTPRequestMethod(): string {
    return this.method;
  }

  private buildCanonicalURI(): string {
    let testPathname = this.pathname;

    // remove relative path components
    const splittedTestPathname = testPathname.split('/..');
    if (splittedTestPathname.length === 1) {
      testPathname = splittedTestPathname[0];
    } else {
      testPathname = splittedTestPathname[splittedTestPathname.length - 1];
    }

    testPathname = testPathname === '' ? '/' : testPathname;

    // remove redundant
    testPathname = testPathname.replace(/\/+/g, '/');
    testPathname = testPathname.replace(/(\.\/)+/g, '');

    return encodeURI(testPathname.normalize());
  }

  private buildCanonicalQueryString(): string {
    const unsortedQueryNameList: string[] = [];
    const query = Helper.queryParser(this.query);

    query.forEach((_, name) => unsortedQueryNameList.push(name));

    return unsortedQueryNameList
      .sort()
      .map(name => {
        const values = query.get(name) || [];
        return `${Helper.fixedEncodeURIComponent(name)}=${Helper.fixedEncodeURIComponent(values.join(','))}`;
      })
      .join('&');
  }

  private buildCanonicalHeaders(): string {

    const unsortedHeaders = new Headers();
    this.headers
      .forEach((values, name) => {
        const trimall = values
          .map(value => value.trim().replace(/\s+/g, ' '))
          .join(',');
        unsortedHeaders.set(name.toLowerCase(), trimall);
      });

    const sortedHeaders = new Headers();
    unsortedHeaders
      .keys()
      .sort()
      .forEach(name => {
        const tname = unsortedHeaders.get(name);
        if (tname === undefined) {
          throw new Error('Internal error.');
        }
        sortedHeaders.set(name, tname);
      });

    let canonicalHeaders = '';
    sortedHeaders
      .forEach((values, name) => {
        canonicalHeaders = canonicalHeaders + `${name}:${values.join(';')}\n`;
      });

    return canonicalHeaders;
  }

  private buildSignedHeaders(): string {
    const lowerCaseHeaderNameList: string[] = [];
    this.headers
      .forEach((_, name) => lowerCaseHeaderNameList.push(name.toLowerCase()));

    return lowerCaseHeaderNameList
      .sort()
      .join(';');
  }
}
