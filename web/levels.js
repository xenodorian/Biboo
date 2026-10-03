(function(){
  var src=(globalThis.__lvParts||[]).join('');
  if(!src) throw new Error('levels parts missing');
  var s=document.createElement('script');
  s.text=src;
  document.documentElement.appendChild(s);
})();
