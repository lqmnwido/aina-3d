import {readFile,writeFile} from 'node:fs/promises';
import {cleanPcmWav} from './audio-cleanup.js';
import {spawnSync} from 'node:child_process';
const folder='../output/audio/aina-dialogue4/';
const input=folder+'aina-ybm-happy-natural-raw.wav';
const paced=folder+'aina-ybm-happy-paced.wav';
// The first phrase ends at 1.132 s; YBM starts after the pause at 1.573 s.
// Close that pause and give the initials a quicker delivery without changing pitch.
const filter='[0:a]asplit=3[a][b][c];[a]atrim=end=1.25,asetpts=PTS-STARTPTS[a0];[b]atrim=start=1.55:end=2.3,asetpts=PTS-STARTPTS,atempo=1.3[b0];[c]atrim=start=2.3,asetpts=PTS-STARTPTS[c0];[a0][b0]acrossfade=d=0.008:curve1=tri:curve2=tri[ab];[ab][c0]acrossfade=d=0.008:curve1=tri:curve2=tri[out]';
const run=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-filter_complex',filter,'-map','[out]','-c:a','pcm_s16le',paced]);
if(run.status!==0)throw Error(run.stderr?.toString()||'Tempo adjustment failed');
const wav=cleanPcmWav(await readFile(paced));
await writeFile('public/audio/aina-ybm-greeting-happy-v3.wav',wav);
await writeFile(folder+'aina-ybm-greeting-happy-v3.wav',wav);
console.log('Prepared fluent happy welcome:',((wav.length-44)/48000).toFixed(2)+'s');
