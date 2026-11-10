(() => {
  const root=document.createElement('div');root.className='account-side-card';
  const heading=document.createElement('h3');heading.textContent='Suas keys CounterFlame';root.append(heading);
  const list=document.createElement('div');root.append(list);
  const update=async()=>{try{const r=await fetch('/api/account/cf/keys',{cache:'no-store'});if(!r.ok){root.hidden=true;return;}const data=await r.json();root.hidden=false;list.replaceChildren();
    if(!data.keys.length){const p=document.createElement('p');p.textContent='Após a confirmação do pagamento, sua key aparece aqui.';list.append(p);}
    for(const key of data.keys){const box=document.createElement('div');box.className='credential-box';const name=document.createElement('small');name.textContent=key.plan+(key.revoked_at?' • Revogada':key.activated_at?' • Ativada':' • Pronta para ativar');const code=document.createElement('code');code.textContent=key.key;code.style.cssText='display:block;overflow-wrap:anywhere;margin:12px 0';const copy=document.createElement('button');copy.className='button button-small button-outline';copy.textContent='Copiar key';copy.onclick=async()=>{try{await navigator.clipboard.writeText(key.key);copy.textContent='Copiada';}catch{code.style.userSelect='all';}};box.append(name,code,copy);list.append(box);}
    const r2=await fetch('/api/cf/loader-release',{cache:'no-store'});if(r2.ok){const release=await r2.json();const url=new URL(release.url);if(url.protocol==='https:'){const link=document.createElement('a');link.className='button button-primary';link.href=url.href;link.textContent='Baixar loader Android';list.append(link);}}
  }catch{root.hidden=true;}};
  const target=document.querySelector('#dashboardView .account-grid');if(target){target.prepend(root);update();setInterval(update,30000);document.addEventListener('submit',()=>setTimeout(update,1500));}
})();
