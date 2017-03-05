import { Headers } from './headers';

export function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, c => {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

export function queryParser(rawQuery = ''): Map<string, string[]> {
    const map = new Map<string, string[]>();
    if (rawQuery.length > 0) {
        const params: string[] = rawQuery.split('&');
        params.forEach((param: string) => {
            const eqIdx = param.indexOf('=');
            const [key, val]: string[] =
                eqIdx === -1 ? [param, ''] : [param.slice(0, eqIdx), param.slice(eqIdx + 1)];
            const list = map.get(key) || [];
            list.push(val);
            map.set(key, list);
        });
    }
    return map;
}

export function urlDecomposition(url: string): { protocol: string, host: string, path: string, pathname: string, query: string } {
    // http://www.example.com/path1/path2?a=b&c=d

    // ['http', 'www.example.com/path1/path2?a=b&c=d']
    let dummy: string[] | string = url.split('://');
    if (dummy.length < 2) {
        throw new Error('URL is not valid.');
    }

    // http
    const protocol = dummy[0];

    // www.example.com/path1/path2?a=b&c=d
    dummy = dummy.slice(1).join('://');

    // ['www.example.com', 'path1', 'path2?a=b&c=d']
    dummy = dummy.split('/');

    // www.example.com
    const host = dummy[0];

    // /path1/path2?a=b$c=d
    const path = '/' + dummy.slice(1).join('/');

    // ['/path1/path2', 'a=b&c=d']
    dummy = path.split('?');

    // /path1/path2
    const pathname = dummy[0];

    // a=b&c=d
    const query = dummy.slice(1).join('?');

    return { protocol, host, path, pathname, query };
}

export function getXAmzDate(date: Date): string {
    const yyyymmddhhmmss = (
        date.getUTCFullYear() * 10000000000
        + (date.getUTCMonth() + 1) * 100000000
        + date.getUTCDate() * 1000000
        + (date.getUTCHours()) * 10000
        + date.getUTCMinutes() * 100
        + date.getUTCSeconds()
    ).toString();

    const yymmdd = yyyymmddhhmmss.substr(0, 8);
    const hhmmss = yyyymmddhhmmss.substr(8, 13);

    return `${yymmdd}T${hhmmss}Z`;
}
