/* Shared accessible dialogs; each request waits for the previous one. */
(() => {
  let queue = Promise.resolve();
  function show(message, confirmation) {
    const task = queue.then(() => new Promise(resolve => {
      const previous = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'system-dialog';
      dialog.setAttribute('aria-labelledby', 'system-dialog-title');
      dialog.setAttribute('aria-describedby', 'system-dialog-message');
      const title = document.createElement('h2');
      title.id = 'system-dialog-title';
      title.textContent = confirmation ? 'ยืนยันการดำเนินการ' : 'แจ้งผลการดำเนินการ';
      const text = document.createElement('p');
      text.id = 'system-dialog-message';
      text.textContent = String(message);
      const actions = document.createElement('div');
      actions.className = 'system-dialog-actions';
      const accept = document.createElement('button');
      accept.className = 'dialog-primary';
      accept.textContent = confirmation ? 'ยืนยัน' : 'รับทราบ';
      accept.onclick = () => dialog.close('yes');
      if (confirmation) {
        const cancel = document.createElement('button');
        cancel.textContent = 'ยกเลิก';
        cancel.autofocus = true;
        cancel.onclick = () => dialog.close('no');
        actions.append(cancel);
      } else accept.autofocus = true;
      actions.append(accept);
      dialog.append(title, text, actions);
      dialog.addEventListener('close', () => {
        const result = dialog.returnValue === 'yes';
        dialog.remove();
        if (previous?.isConnected) previous.focus();
        resolve(result);
      }, {once:true});
      document.body.append(dialog);
      dialog.showModal();
    }));
    queue = task.catch(() => {});
    return task;
  }
  window.appConfirm = message => show(message, true);
  window.appAlert = message => show(message, false);
})();
