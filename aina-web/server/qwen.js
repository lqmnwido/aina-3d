import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

export const GREETING = 'Selamat Datang YBM! Sila beri arahan untuk lancarkan V2T.';
export const event = (type, fields = {}) => ({ event_id: randomUUID(), type, ...fields });
export function asrSession() {
  return event('session.update', { session: {
    input_audio_format: 'pcm', sample_rate: 16000,
    input_audio_transcription: { language: 'ms' },
    turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: 700 },
  } });
}
export function normalizeASR(message) {
  if (message.type === 'session.updated') return { type: 'ready' };
  if (message.type === 'input_audio_buffer.speech_started') return { type: 'speech-start' };
  if (message.type === 'conversation.item.input_audio_transcription.text')
    return { type: 'partial', text: (message.text || '') + (message.stash || ''), id: message.item_id };
  if (message.type === 'conversation.item.input_audio_transcription.completed')
    return { type: 'final', text: message.transcript || '', id: message.item_id };
  if (message.type === 'session.finished') return { type: 'finished' };
  if (message.type === 'error' || message.type.endsWith('.failed'))
    return { type: 'error', message: message.error?.message || 'Qwen recognition failed.' };
  return null;
}
export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 24) throw new Error('Provide 1–24 messages.');
  return messages.map(m => {
    if (!['user', 'assistant'].includes(m?.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000)
      throw new Error('Invalid chat message.');
    return { role: m.role, content: m.content };
  });
}
export function wavFromPCM(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export function synthesize(text, config, signal) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.wsURL); url.searchParams.set('model', config.ttsModel);
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${config.key}` }, handshakeTimeout: 10000 });
    const chunks = []; let size = 0; let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); ws.close();
      if (error) reject(error);
      else if (!size) reject(new Error('TTS returned no audio.'));
      else resolve(wavFromPCM(Buffer.concat(chunks)));
    };
    const abort = () => finish(new Error('Speech cancelled.'));
    const timer = setTimeout(() => finish(new Error('TTS timed out.')), 45000);
    signal?.addEventListener('abort', abort, { once: true });
    ws.on('open', () => ws.send(JSON.stringify(event('session.update', { session: {
      mode: 'commit', voice: config.ttsVoice, language_type: config.ttsLanguage,
      response_format: 'pcm', sample_rate: 24000,
    } }))));
    ws.on('message', raw => {
      try {
        const m = JSON.parse(raw);
        if (m.type === 'session.updated') {
          ws.send(JSON.stringify(event('input_text_buffer.append', { text })));
          ws.send(JSON.stringify(event('input_text_buffer.commit')));
          ws.send(JSON.stringify(event('session.finish')));
        } else if (m.type === 'response.audio.delta') {
          const chunk = Buffer.from(m.delta, 'base64'); size += chunk.length;
          if (size > 16 * 1024 * 1024) return finish(new Error('Speech audio too large.'));
          chunks.push(chunk);
        } else if (m.type === 'session.finished') finish();
        else if (m.type === 'error' || (m.type === 'response.done' && m.response?.status === 'failed'))
          finish(new Error(m.error?.message || 'Speech synthesis failed.'));
      } catch (e) { finish(e); }
    });
    ws.on('error', () => finish(new Error('Cannot connect to Qwen TTS. Check server credentials and region.')));
    ws.on('close', () => { if (!settled) finish(new Error('TTS disconnected before completion.')); });
    if (signal?.aborted) abort();
  });
}
