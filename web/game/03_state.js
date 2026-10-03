(function(){
  var src=(globalThis.__stParts||[]).join('');
  if(!src) throw new Error('03_state parts missing');
  var s=document.createElement('script');
  s.text=src;
  document.documentElement.appendChild(s);
})();
