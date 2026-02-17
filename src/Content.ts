function assert<T>(p:T,m:string) {
    if(!p) throw new Error(m);
    return p;
}
export type ContentBuffer = Uint8Array<ArrayBuffer> | ArrayBuffer;
let BufferImpl: typeof Buffer | undefined=( (globalThis as any).Buffer);
const textEncoder=new TextEncoder();
const textDecoder=new TextDecoder();
export type SerializedContent={contentType?:string}&(
    {plain:string}|{url:string}|{uint8Array:Uint8Array<ArrayBuffer>}|{arrayBuffer:ArrayBuffer}
);
export class Content {
    contentType?: string;
    plain?: string;
    url?: string;
    nodeBuffer?: Buffer<ArrayBuffer>;
    uint8Array?: Uint8Array<ArrayBuffer>;
    arrayBuffer?: ArrayBuffer;
    //bufType?: "node" | "array1" | "array2";

    // -------- static methods --------
    static setBufferPolyfill(b: typeof Buffer) {
        BufferImpl = b;
    }
    static deserialize(s: SerializedContent): Content {
        if ("plain" in s) return Content.plainText(s.plain, s.contentType);
        else if ("url" in s) return Content.url(s.url);
        else if ("uint8Array" in s) return Content.bin(s.uint8Array, s.contentType ?? "application/octet-stream");
        else if ("arrayBuffer" in s) return Content.bin(s.arrayBuffer, s.contentType ?? "application/octet-stream");
        else throw new Error("Invalid serialized content");
    }

    static plainText(text: string, contentType: string = "text/plain"): Content {
        const c = new Content();
        c.contentType = contentType;
        c.plain = text;
        return c;
    }

    static url(url: string): Content {
        const c = new Content();
        c.url = url;
        return c;
    }
    /**
     * Mixed-Text format is a text format for a binary data where:
       If the binary data represents an utf-8 text and the text does NOT begin with 'data:', 
        it may be encoded as either utf-8 text or dataURL.
       Otherwise, it should always be encoded as dataURL.
     * @param text 
     * @returns Content
     */
    static mixedText(text: string): Content {
        if (Content.looksLikeDataURL(text)) return Content.url(text);
        return Content.plainText(text);
    }

    static bin(bin: ContentBuffer, contentType: string): Content {
        assert(contentType, "contentType should be set");
        const c = new Content();
        //const BufferImpl = this.BufferImpl ?? Buffer;

        if (Content.isNodeBuffer(bin)) {
            //c.bufType = "node";
            c.nodeBuffer = bin;
        } else if (Content.isArrayBuffer(bin)) {
            //c.bufType = "array2";
            c.arrayBuffer = bin;
        } else if (Content.isUint8Array(bin)) {
            c.uint8Array = bin;
        } else {
            throw new Error(`${bin} is not a bin`);
        }
        c.contentType = contentType;
        return c;
    }

    static buffer2ArrayBuffer(a: Uint8Array<ArrayBuffer>): ArrayBuffer {
        return Content.toDedicatedArrayBuffer(a);
    }

    static arrayBuffer2Buffer(a: ArrayBuffer): Buffer<ArrayBuffer> {
        if (!BufferImpl) throw new Error("Buffer is not supported");
        if (a instanceof ArrayBuffer) {
            return BufferImpl.from(new Uint8Array(a));
        }
        return assert(a, "a2n: a is not set");
    }
    static isUint8Array(a: any): a is Uint8Array {
        return a instanceof Uint8Array ||
            (a && Content.isArrayBuffer(a.buffer) 
            && a.BYTES_PER_ELEMENT===1);
    }

    static isArrayBuffer(buf: any): buf is ArrayBuffer {
        return buf instanceof ArrayBuffer ||
            (buf &&
                typeof buf.byteLength === "number" &&
                typeof buf.length !== "number" &&
            !(buf.buffer));
    }
    static isNodeBuffer(data: any): data is Buffer<ArrayBuffer> {
        return !!BufferImpl && data instanceof BufferImpl;
    }
    static hasDedicatedArrayBuffer(buf:Uint8Array<ArrayBuffer>) {
        return buf.byteOffset===0 && buf.buffer.byteLength===buf.byteLength;
    }
    static toDedicatedArrayBuffer(buf:Uint8Array<ArrayBuffer>) {
        if (Content.hasDedicatedArrayBuffer(buf)) return buf.buffer;
        return Uint8Array.from(buf).buffer;
    }
    static looksLikeDataURL(text: string): boolean {
        return /^data:/.test(text);
    }

    static nodeBufferAvaliable(): boolean {
        return !!BufferImpl;
    }
    /** @deprecated use nodeBufferAvailable */
    static hasNodeBuffer(): boolean {
        return Content.nodeBufferAvaliable();
    }


    // -------- instance methods --------
    serialize(): SerializedContent {
        if (this.hasPlainText()) return { plain: this.plain!, contentType: this.contentType };
        else if (this.hasURL()) return { url: this.url! };
        else if (this.hasNodeBuffer()) return { uint8Array: new Uint8Array(this.nodeBuffer!.buffer, this.nodeBuffer!.byteOffset, this.nodeBuffer!.byteLength), contentType: this.contentType };
        else if (this.hasArrayBuffer()) return { arrayBuffer: this.arrayBuffer!, contentType: this.contentType };
        else throw new Error("No content to serialize");
    }
    toBin(binType?: typeof Buffer): Buffer<ArrayBuffer>;
    toBin(binType?: typeof ArrayBuffer): ArrayBuffer;
    toBin(binType?: typeof Uint8Array): Uint8Array<ArrayBuffer>;
    toBin(binType?: any): ContentBuffer  {
        binType = binType || ( BufferImpl ?? ArrayBuffer);
        if (binType===Uint8Array) return this.toUint8Array();
        else if (binType===BufferImpl) {
            return this.toNodeBuffer();
        } else if (binType===ArrayBuffer) {
            return this.toArrayBuffer();
        }
        throw new Error("Invalid binType");
    }
    toUint8Array():Uint8Array<ArrayBuffer> {
        if (this.uint8Array) return this.uint8Array;
        let theAry:Uint8Array<ArrayBuffer>;
        if (this.nodeBuffer) theAry=this.nodeBuffer;
        else if (this.arrayBuffer) theAry=new Uint8Array(this.arrayBuffer);
        else if (this.url) {
            const d = new DataURL(this.url);
            theAry=d.buffer;
        } else if (this.plain != null) {
            theAry=textEncoder.encode(this.plain) as Uint8Array<ArrayBuffer>;
        } else {
            throw new Error("No data");
        }
        this.uint8Array=theAry;
        return theAry;
    }

    toArrayBuffer(): ArrayBuffer {
        if (this.arrayBuffer) return this.arrayBuffer;
        const theAry=this.toUint8Array();
        this.arrayBuffer=Content.toDedicatedArrayBuffer(theAry);
        return this.arrayBuffer;
    }

    toNodeBuffer(): Buffer<ArrayBuffer> {
        if (this.nodeBuffer) return this.nodeBuffer;
        if (!BufferImpl) throw new Error("Buffer is not supported");
        const theAry=this.toUint8Array();
        this.nodeBuffer=BufferImpl.from(theAry);
        return this.nodeBuffer;
    }

    toURL(): string {
        if (this.url) return this.url;
        const u=this.toUint8Array();
        if (!this.contentType) throw new Error("toURL: contentType shoule be set");
        const d = new DataURL(u, this.contentType);
        this.url = d.toURL();
        return this.url;
    }

    toPlainText(): string {
        if (this.hasPlainText()) return this.plain!;
        this.plain = textDecoder.decode(this.toUint8Array());
        return this.plain;
    }

    toMixedText(): string {
        if (this.hasPlainText() && !Content.looksLikeDataURL(this.plain!)) return this.plain!;
        return this.toURL();
    }

    hasURL(): boolean { return !!this.url; }
    hasPlainText(): boolean { return this.plain != null; }
    hasBin(): boolean { return this.hasArrayBuffer() || this.hasUint8Array(); }
    hasArrayBuffer(): boolean { return !!this.arrayBuffer; }
    hasUint8Array(): boolean { return this.hasNodeBuffer()||!!this.uint8Array;}
    hasNodeBuffer(): boolean { return !!this.nodeBuffer; }
    roughSize(){
        if (this.hasNodeBuffer()) return this.nodeBuffer!.byteLength;
        if (this.hasArrayBuffer()) return this.arrayBuffer!.byteLength;
        if (this.hasPlainText()) return this.plain!.length;
        if (this.hasURL()) return this.url!.length;
        return 0;
    }

    toBlob(): Blob {
        return new Blob([this.toArrayBuffer()], { type: this.contentType });
    }
}

export class DataURL {
    url: string;
    buffer: Uint8Array<ArrayBuffer>;
    constructor(data: string);
    constructor(data: Uint8Array<ArrayBuffer>, contentType:string);
    constructor(data: string|Uint8Array<ArrayBuffer>, public contentType?: string) {
        if (typeof data === "string") {
            this.url = data;
            this.buffer=this.toUint8Array();
        } else{
            this.contentType = contentType as string;
            this.buffer=data;
            this.url=this.toURL();
        }
        if (!this.contentType) throw new Error("Content-type is not set");
    }

    toURL(): string {
        if (this.url) return this.url;
        if (!this.contentType) throw new Error("Content-type is not set");
        const head = DataURL.dataHeader(this.contentType);
        const base64 = base64_From_Uint8Array(this.buffer);
        this.url = head + base64;
        return this.url;
    }

    toUint8Array(): Uint8Array<ArrayBuffer> {
        if (this.buffer) return this.buffer;
        const dataURL: string=this.url;
        const reg = /^data:([^;]+);base64,/i;
        const r = reg.exec(dataURL);
        if (!r) throw new Error(`malformed dataURL: ${dataURL.slice(0, 100)}`);
        this.contentType = r[1];
        this.buffer = base64_To_Uint8Array(dataURL.substring(r[0].length));
        return this.buffer;
    }

    static dataHeader(ctype: string): string {
        return "data:" + ctype + ";base64,";
    }

    toString(): string {
        return this.url;
    }
};


export function base64_To_Uint8Array(base64: string):Uint8Array<ArrayBuffer> {
    base64 = base64.replace(/[\n=]/g, "");
    const dic: Record<number, number> = {};
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < chars.length; i++) dic[chars.charCodeAt(i)] = i;

    const num = base64.length;
    let n = 0, b = 0;
    if (!num) return new Uint8Array(0);

    let e = Math.floor(num / 4 * 3);
    if (base64.charAt(num - 1) === "=") e -= 1;
    if (base64.charAt(num - 2) === "=") e -= 1;

    const ary_u8 = new Uint8Array(e);
    let i = 0, p = 0;

    const fail = (m: string) => {
        console.log(m);
        console.log(base64, i);
        throw new Error(m);
    };

    while (p < e) {
        b = dic[base64.charCodeAt(i)];
        if (b === undefined) fail("Invalid letter");
        n = (b << 2);
        i++;

        b = dic[base64.charCodeAt(i)];
        if (b === undefined) fail("Invalid letter");
        ary_u8[p] = n | ((b >> 4) & 0x3);
        n = (b & 0x0f) << 4;
        i++;
        p++;
        if (p >= e) break;

        b = dic[base64.charCodeAt(i)];
        if (b === undefined) fail("Invalid letter");
        ary_u8[p] = n | ((b >> 2) & 0xf);
        n = (b & 0x03) << 6;
        i++;
        p++;
        if (p >= e) break;

        b = dic[base64.charCodeAt(i)];
        if (b === undefined) fail("Invalid letter");
        ary_u8[p] = n | b;
        i++;
        p++;
    }
    return ary_u8;
}

export function base64_From_Uint8Array(ary_buffer: Uint8Array<ArrayBuffer>): string {
    const dic = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    const ary_u8 = new Uint8Array(ary_buffer);
    let base64 = "";
    let i = 0, n = 0, b = 0;

    while (i < ary_u8.length) {
        b = ary_u8[i];
        base64 += dic[b >> 2];
        n = (b & 0x03) << 4;
        i++;
        if (i >= ary_u8.length) break;

        b = ary_u8[i];
        base64 += dic[n | (b >> 4)];
        n = (b & 0x0f) << 2;
        i++;
        if (i >= ary_u8.length) break;

        b = ary_u8[i];
        base64 += dic[n | (b >> 6)];
        base64 += dic[b & 0x3f];
        i++;
    }

    const m = ary_u8.length % 3;
    if (m) base64 += dic[n];
    if (m === 1) base64 += "==";
    else if (m === 2) base64 += "=";
    return base64;
}
