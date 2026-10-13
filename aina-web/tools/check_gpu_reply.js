const base='http://127.0.0.1:11434';
for(const model of ['qwen3:0.6b','qwen3:1.7b']){
  for(const content of ['Apakah maksud tenaga solar?','Saya rasa sedih hari ini.','Siapa nama awak?']){
    const began=performance.now();const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,think:false,keep_alive:'5m',options:{num_gpu:99,num_ctx:1024,num_predict:64},messages:[{role:'system',content:'Anda Aina, teman suara yang ceria. Jawab dalam Bahasa Melayu Malaysia yang semula jadi. Maksimum dua ayat, 18 perkataan keseluruhan. Jangan gunakan markdown. Jangan mendakwa boleh melakukan tindakan yang tidak tersedia.'},{role:'user',content}]})});
    const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data));
    const ps=await(await fetch(base+'/api/ps')).json();const engine=ps.models.find(m=>m.name===model);
    console.log(JSON.stringify({model,content,seconds:(performance.now()-began)/1000,loadSeconds:data.load_duration/1e9,text:data.message.content,size:engine?.size,gpuBytes:engine?.size_vram}));
  }
  await fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0})});
}
