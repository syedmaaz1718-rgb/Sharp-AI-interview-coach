let installPrompt=null
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault(); installPrompt=event; window.dispatchEvent(new Event('sharpai-install-ready'))
})
window.addEventListener('appinstalled',()=>{installPrompt=null;window.dispatchEvent(new Event('sharpai-install-ready'))})
export const canInstall=()=>!!installPrompt
export const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
export async function installApp(){const prompt=installPrompt;if(!prompt)return false;installPrompt=null;await prompt.prompt();await prompt.userChoice;window.dispatchEvent(new Event('sharpai-install-ready'));return true}
export function registerPwa(){
  if(!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext)return
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{/* Standard web use remains available if registration fails. */}))
}
