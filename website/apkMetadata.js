import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);

export async function inspectApk(file,kind,run=execute){
  const options={timeout:180000,maxBuffer:1024*1024};
  const signed=await run(process.env.APKSIGNER_BIN||'apksigner',['verify','--print-certs',file],options);
  const certs=[...signed.stdout.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})/gi)];
  if(certs.length!==1)throw Error('invalid_signature');
  const badging=await run(process.env.AAPT_BIN||'aapt',['dump','badging',file],options);
  const match=/package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'/.exec(badging.stdout);
  const expected=kind==='loader'?'com.cf.overlay':'com.ScarletWork.CounterFlame';
  if(!match||match[1]!==expected)throw Error('wrong_package');
  const versionCode=Number(match[2]);if(!Number.isSafeInteger(versionCode)||versionCode<1)throw Error('invalid_version');
  return {packageName:match[1],versionCode,versionName:match[3],certificateSha256:certs[0][1].toLowerCase(),label:kind==='loader'?'LC - CounterFlame Private':`CounterFlame ${match[3]} (${versionCode})`};
}
