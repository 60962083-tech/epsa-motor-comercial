function listarTriggersFacturas() {
  return ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'procesarCorreosPendientes';
  }).map(function (trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource())
    };
  });
}

function instalarTriggerFacturas() {
  var existing = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'procesarCorreosPendientes';
  });
  if (existing.length > 0) {
    // Conserva uno y elimina duplicados solo cuando el operador invoca la instalación.
    existing.slice(1).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
    return { installed: false, existing: true, remaining: 1 };
  }
  ScriptApp.newTrigger('procesarCorreosPendientes').timeBased().everyMinutes(5).create();
  return { installed: true, existing: false, remaining: 1 };
}

function eliminarTriggersFacturas() {
  var existing = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'procesarCorreosPendientes';
  });
  existing.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  return { deleted: existing.length };
}

function recrearTriggerFacturas() {
  eliminarTriggersFacturas();
  return instalarTriggerFacturas();
}
