import {Content} from "../src/Content.js";
import * as assert from "assert";
import {Buffer} from "buffer";
function checkSameContent(c1:Content, c2:Content, tag="checkSameContent") {
    assert.ok(contEq(
        c1.toUint8Array(), c2.toUint8Array()), tag);
}
function contEq(a:ArrayBuffer|Uint8Array<ArrayBuffer>|string, b:ArrayBuffer|Uint8Array<ArrayBuffer>|string) {
    if (typeof a!==typeof b)return false;
    if (typeof a==="string") return a===b;
    if (typeof b==="string") return false;
    if (a instanceof ArrayBuffer) a=new Uint8Array(a);
    if (b instanceof ArrayBuffer) b=new Uint8Array(b);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i]!==b[i]) return false;
    return true;
}
type CodecSet<T>={src:T, toc:(src:T)=>Content, fromc:(src:Content)=>T};
function testContent() {
    const a=[0xe3, 0x81, 0xa6, 0xe3, 0x81, 0x99, 0xe3, 0x81, 0xa8, 0x61, 0x62, 0x63];
    function c<T>(src: T, toc: (src:T)=>Content, fromc:  (src:Content)=>T):CodecSet<T> {
        return {src, toc, fromc};
    }
    const conts/*:{[key:string]: CodecSet<any>}*/={
        p:c("てすとabc", (s:string)=>Content.plainText(s), (c:Content)=>c.toPlainText()),
        d:c("data:text/plain;base64,44Gm44GZ44GoYWJj", (d:string)=>Content.url(d), (c:Content)=>c.toURL()),
        u:c(Uint8Array.from(a), (u:Uint8Array<ArrayBuffer>)=>Content.bin(u, "text/plain"), (c:Content)=>c.toUint8Array()),
        a:c(Uint8Array.from(a).buffer, (a:ArrayBuffer)=>Content.bin(a, "text/plain"), (c:Content)=>c.toArrayBuffer()),
        n:c(Buffer.from(a),(n:Buffer<ArrayBuffer>)=>Content.bin(n, "text/plain"), (c:Content)=>c.toNodeBuffer()),
    };
    type K=keyof typeof conts;
    //const SRC=0, TOCONT=1, FROMCONT=2;
    let binLen=(conts.a.src as ArrayBuffer).byteLength;
    for (let tfrom of Object.keys(conts) ) 
        for (let tto of Object.keys(conts) ) chk(tfrom as K,tto as K);
    function chk(tfrom: K ,tto: K) {
        const cf=conts[tfrom] as CodecSet<any>;
        const ct=conts[tto] as CodecSet<any>;
        const src=cf.src;
        const c=cf.toc(src);
        if (c.hasNodeBuffer()) {
            assert.equal(((c as any).nodeBuffer as Buffer).length, binLen,"Bin length not match");
        }
        const dst=ct.fromc(c);
        console.log("Convert Content ",tfrom,"->",tto);
        if (!contEq(dst, ct.src)) {
            console.log("Actual: ",dst);
            console.log("Expected: ",ct.src);
            throw new Error(`Fail at ${tfrom} to ${tto}`);
        }
    }
}
function testSlice() {
    const orig=new Uint8Array([10,20,30,40,50,60]);
    const sub=orig.subarray(1,3);
    assert.ok( Content.hasDedicatedArrayBuffer(orig));
    assert.ok( !Content.hasDedicatedArrayBuffer(sub));
    const co=Content.bin(orig,"application/octet-stream");
    const cs=Content.bin(sub,"application/octet-stream");
    assert.ok( orig.buffer===sub.buffer);
    assert.ok( co.toArrayBuffer()===orig.buffer);
    assert.ok( co.toArrayBuffer().byteLength==6);
    assert.ok( cs.toArrayBuffer()!==sub.buffer);
    assert.ok( cs.toArrayBuffer().byteLength==2);
    console.log(co);
    console.log(cs);
}
function testMixedText() {
    const bin=new Uint8Array([0,1,2]);
    const cbin=Content.bin(bin,"application/octet-stream");
    console.log(cbin.toMixedText());
    const pABC=Content.plainText("ABC");
    console.log(pABC.toURL());
    const encode_bin="data:application/octet-stream;base64,AAEC";
    const encode_ABC="data:text/plain;base64,QUJD";
    const pE_ABC=Content.plainText(encode_ABC);
    const encode_encode_ABC=pE_ABC.toURL();
    // data:text/plain;base64,ZGF0YTp0ZXh0L3BsYWluO2Jhc2U2NCxRVUpE";
    //                        dat a:t ext /pl ain ;ba se6 4,Q UJD
    const mE_bin=Content.mixedText(encode_bin);
    const mABC=Content.mixedText("ABC");
    const mE_ABC=Content.mixedText(encode_ABC);
    console.log(mE_bin.toUint8Array());
    console.log(mABC.toUint8Array());
    console.log(mE_ABC.toUint8Array());
    console.log(pE_ABC.toUint8Array());
    assert.ok(mE_bin.toUint8Array().length===bin.length);
    assert.ok(mABC.toUint8Array().length==="ABC".length);
    assert.ok(mE_ABC.toUint8Array().length==="ABC".length);
    assert.ok(pE_ABC.toUint8Array().length===encode_ABC.length);

    console.log(cbin.toMixedText());
    console.log(mE_bin.toMixedText());
    console.log(pABC.toMixedText());
    console.log(mABC.toMixedText());
    console.log(mE_ABC.toMixedText());
    console.log(pE_ABC.toMixedText());
    assert.ok(cbin.toMixedText()===encode_bin);
    assert.ok(mE_bin.toMixedText()===encode_bin);
    assert.ok(pABC.toMixedText()==="ABC");
    assert.ok(mABC.toMixedText()==="ABC");
    assert.ok(mE_ABC.toMixedText()===encode_ABC);
    assert.ok(pE_ABC.toMixedText()===encode_encode_ABC);
    //Content.plainText();

}
function testDataURLWithCharset() {
    const encode_ABC="data:text/plain;base64,QUJD";
    const encode_ABC_with_charset="data:text/plain;charset=utf8;base64,QUJD";
    const c_ABC=Content.url(encode_ABC);
    const c_ABC_with_charset=Content.url(encode_ABC_with_charset);
    assert.equal(c_ABC.contentType,"text/plain");
    assert.equal(c_ABC_with_charset.contentType,"text/plain;charset=utf8");
    contEq(c_ABC.toUint8Array(), c_ABC_with_charset.toUint8Array());
    assert.equal(c_ABC.toPlainText(), "ABC");
    assert.equal(c_ABC_with_charset.toPlainText(),"ABC");
    assert.equal(c_ABC.toURL(),encode_ABC);
    assert.equal(c_ABC_with_charset.toURL(),encode_ABC_with_charset);
    console.log(c_ABC.toURL());
    console.log(c_ABC_with_charset.toURL());
}
testContent();
testSlice();
testMixedText();
testDataURLWithCharset();