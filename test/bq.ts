import { AMFDecoder, AMFEncoder } from 'amf-ts';

const base64 = 'CoFTAQVidA1jb25EYXkNY29uT2JqB2RwcwlsaWZlE2xvZ2luVGltZQVsdAVsdhltaWxpdGFyeVJhbmsLbW9uZXkFbXAVcGxheWVyTmFtZQd2aXAGJzIwMjYtMDItMTAgMTA6NTQ6MjMEZAoLAQczNzcECgczNzYEFAczNzUEHgEFQMgc1cKPXCkEh2gGGgQUBGMGD0dlbmVyYWwEtqA4Bg1CZWlEb3UGFVRlc3RQbGF5ZXIGC1ZJUDEw';

const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const decoder = new AMFDecoder(buffer);
const result = decoder.decode();

console.log('Decoded:', result);

// Re-encode and compare
const encoder = new AMFEncoder();
encoder.writeObject(result);
const reEncoded = encoder.getBuffer()
const reBase64 = btoa(String.fromCharCode(...reEncoded));

var redecoder = new AMFDecoder(reEncoded);
var reResult = redecoder.decode();
console.log('Re-decoded:', reResult);

