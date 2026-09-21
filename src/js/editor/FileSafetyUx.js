// FS5: accessible recovery, unsaved-work, and file-state presentation.
(() => {
  const errorMessages = Object.freeze({
    "invalid-file": "This file is damaged or is not a valid Caderact drawing.", "invalid-dxf": "This DXF file is damaged or malformed.",
    "incompatible-version": "This file was created by a newer, incompatible version.", "resource-rejected": "This file is too large or complex to open safely.",
    "unsupported-document": "This drawing contains content that DXF export cannot represent.", "permission-denied": "Caderact does not have permission to access that file.",
    "read-failed": "The selected file could not be read.", "write-failed": "The file could not be written. Your drawing remains unsaved.",
    "serialization-failed": "The drawing could not be prepared for saving.", "replacement-failed": "The validated drawing could not be opened.",
    "save-not-confirmed": "The download started, but durable saving could not be confirmed. Your drawing was kept open.",
    "save-not-completed": "The drawing was not saved, so the current drawing was kept open.",
  })
  const recoverable = value => ["valid-newer", "valid-unresolved"].includes(value.classification)
  const dateLabel = timestamp => { try { return new Date(timestamp).toLocaleString() } catch { return "Unknown time" } }
  function create({ recoveryValidation, session, fileState, autosave, viewport, commandRouter, getFileActions = () => window.caderactFiles,
    feedback = () => window.caderactFeedback, elements = {} } = {}) {
    const byId = id => elements[id] || document.querySelector(`#${id}`)
    const recoveryDialog=byId("recovery-dialog"),recoveryMessage=byId("recovery-message"),recoverySelect=byId("recovery-candidates"),recoveryDetails=byId("recovery-details")
    const recoverButton=byId("recovery-apply"),dismissButton=byId("recovery-dismiss"),recoveryCancel=byId("recovery-cancel")
    const unsavedDialog=byId("unsaved-dialog"),unsavedMessage=byId("unsaved-message"),saveButton=byId("unsaved-save"),discardButton=byId("unsaved-discard"),cancelButton=byId("unsaved-cancel")
    const saveState=byId("document-save-state")
    let candidates=[],selectedIndex=0,unsavedResolve=null,focusBefore=null,unsubscribeHistory=null
    function announce(message, kind="status") { feedback()?.showTemporary(message, kind) }
    function renderSaveState(mode) {
      if (!saveState) return
      const filename=fileState.value.displayName,dirty=session.controller.isDirty
      saveState.textContent=mode==="saving"?`${filename} — Saving…`:mode==="failed"?`${filename} — Save failed`:mode==="initiated"?`${filename} — Download unconfirmed`:dirty?`${filename} — Unsaved changes`:`${filename} — Saved`
      saveState.classList.toggle("is-dirty",dirty||mode==="initiated");saveState.classList.toggle("is-error",mode==="failed")
    }
    function bindController(){unsubscribeHistory?.();unsubscribeHistory=session.controller.subscribeHistory(()=>renderSaveState())}
    function closeRecovery(){if(recoveryDialog)recoveryDialog.hidden=true;focusBefore?.focus?.();focusBefore=null}
    function closeUnsaved(decision){if(!unsavedResolve)return;const resolve=unsavedResolve;unsavedResolve=null;if(unsavedDialog)unsavedDialog.hidden=true;focusBefore?.focus?.();focusBefore=null;resolve(decision)}
    function requestUnsaved({operation,filename}={}) {
      if(unsavedResolve)return Promise.resolve("cancel")
      focusBefore=document.activeElement
      if(unsavedMessage)unsavedMessage.textContent=`${filename||"This drawing"} has unsaved changes. Save before ${operation||"continuing"}?`
      if(unsavedDialog)unsavedDialog.hidden=false
      cancelButton?.focus()
      return new Promise(resolve=>{unsavedResolve=resolve})
    }
    function selected(){return candidates[selectedIndex]||null}
    function renderCandidate(){const value=selected();if(!value)return;if(recoveryDetails)recoveryDetails.textContent=recoverable(value)?`${dateLabel(value.timestamp)} · ${value.classification==="valid-newer"?"Unsaved work":"Recovery status needs confirmation"}`:value.classification==="incompatible-version"?"This recovery was created by a newer incompatible version.":value.classification==="excessive-resource-rejected"?"This recovery is too large or complex to open safely.":"This recovery is damaged and cannot be opened safely.";if(recoverButton)recoverButton.disabled=!recoverable(value)}
    function showCandidates(values){candidates=values;selectedIndex=0;if(!recoveryDialog)return;if(recoverySelect){recoverySelect.replaceChildren(...values.map((value,index)=>{const option=document.createElement("option");option.value=String(index);option.textContent=`${value.displayName||value.filename||"Recovered drawing"} — ${dateLabel(value.timestamp)}`;return option}));recoverySelect.hidden=values.length<2}if(recoveryMessage)recoveryMessage.textContent=values.some(recoverable)?"Caderact found work that may not have been saved.":"Caderact found recovery data that cannot be safely opened.";recoveryDialog.hidden=false;focusBefore=document.activeElement;(values.some(recoverable)?recoverButton:dismissButton)?.focus();renderCandidate()}
    async function startup(){const context={manualSaveFingerprint:fileState.value.lastManualSaveFingerprint,lastSuccessfulSave:fileState.value.lastSuccessfulSave,currentRecoveryKey:autosave?.recoveryKey};const result=await recoveryValidation.classifyAll(context);if(result.status!=="recovery-list-classified"){announce("Recovery storage could not be checked. Your current drawing is unaffected.","error");return result}const relevant=result.candidates.filter(value=>recoverable(value)||["corrupt-envelope","fingerprint-mismatch","invalid-document","incompatible-version","excessive-resource-rejected"].includes(value.classification));relevant.sort((a,b)=>(recoverable(b)?1:0)-(recoverable(a)?1:0));if(relevant.length)showCandidates(relevant);return result}
    async function recover(){const candidate=selected();if(!recoverable(candidate))return;if(session.controller.isDirty){const decision=await requestUnsaved({operation:"recovering",filename:fileState.value.displayName});if(decision==="save"){const saved=await getFileActions().save();if(saved?.durability!=="committed"){announce(errorMessages[saved?.durability==="initiated"?"save-not-confirmed":"save-not-completed"],"error");return}}else if(decision!=="discard")return}const outcome=await recoveryValidation.apply(candidate,{session,fileState,autosave,commandRouter,viewport});if(outcome.status==="recovery-applied"){closeRecovery();renderSaveState();announce("Recovered drawing opened. Save it to keep these changes.")}else announce("The recovery could not be opened. Your current drawing is unchanged.","error")}
    async function dismiss(){const candidate=selected();if(!candidate)return;const outcome=await recoveryValidation.dismiss(candidate.recoveryKey);if(outcome.status==="recovery-deleted"){candidates.splice(selectedIndex,1);if(!candidates.length){closeRecovery();announce("Recovery dismissed.");return}selectedIndex=Math.min(selectedIndex,candidates.length-1);showCandidates(candidates)}else announce("Recovery could not be dismissed. It remains available.","error")}
    function presentOutcome(outcome){if(!outcome?.status)return;if(outcome.status.endsWith("-started")){renderSaveState("saving");return}if(outcome.status.endsWith("-initiated")){renderSaveState("initiated");announce("Download started, but durable saving could not be confirmed.");return}if(outcome.status.endsWith("-failed")){renderSaveState("failed");announce(errorMessages[outcome.reason]||"The file operation failed. Your current drawing is unchanged.","error");return}if(outcome.status.endsWith("-cancelled")){renderSaveState();return}if(outcome.status.endsWith("-completed")){renderSaveState();return}}
    function presentAutosave(outcome){if(outcome?.status==="autosave-failed")announce("Automatic recovery could not be updated. Save your drawing manually.","error")}
    function modalKeydown(event){const active=!unsavedDialog?.hidden?"unsaved":!recoveryDialog?.hidden?"recovery":null;if(!active)return;if(event.key==="Escape"){event.preventDefault();active==="unsaved"?closeUnsaved("cancel"):closeRecovery();return}if(event.key==="Enter"&&active==="unsaved"){event.preventDefault();closeUnsaved("cancel");return}if(event.key==="Tab"){const controls=active==="unsaved"?[discardButton,saveButton,cancelButton]:[recoverySelect,dismissButton,recoveryCancel,recoverButton],available=controls.filter(control=>control&&!control.hidden&&!control.disabled),index=available.indexOf(document.activeElement);if(!available.length)return;if(event.shiftKey&&index<=0){event.preventDefault();available.at(-1).focus()}else if(!event.shiftKey&&index===available.length-1){event.preventDefault();available[0].focus()}}}
    saveButton?.addEventListener("click",()=>closeUnsaved("save"));discardButton?.addEventListener("click",()=>closeUnsaved("discard"));cancelButton?.addEventListener("click",()=>closeUnsaved("cancel"))
    recoverButton?.addEventListener("click",recover);dismissButton?.addEventListener("click",dismiss);recoveryCancel?.addEventListener("click",closeRecovery)
    recoverySelect?.addEventListener("change",()=>{selectedIndex=Number(recoverySelect.value)||0;renderCandidate()});document.addEventListener("keydown",modalKeydown)
    window.addEventListener("beforeunload",event=>{if(!session.controller.isDirty)return;event.preventDefault();event.returnValue=""})
    session.subscribe(()=>{bindController();renderSaveState()});fileState.subscribe(()=>renderSaveState());bindController();renderSaveState()
    return Object.freeze({startup,requestUnsaved,presentOutcome,presentAutosave,recover,dismiss,get candidates(){return Object.freeze(Array.from(candidates))}})
  }
  window.CaderactFileSafetyUx=Object.freeze({create,errorMessages})
})()
