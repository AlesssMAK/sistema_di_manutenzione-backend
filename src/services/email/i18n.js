// Localized strings for every email. One dictionary per supported locale;
// `it` is the fallback. Structure is language-agnostic — the render layer
// (render.js) decides which fields to show — so translators only touch text.
// Placeholders use {name} / {faultId} / {worker} etc. and are filled by
// interp() in render.js.

export const EMAIL_LOCALES = ['it', 'en', 'es', 'pl'];
export const DEFAULT_EMAIL_LOCALE = 'it';

export const STRINGS = {
  it: {
    common: {
      greeting: 'Ciao {name},',
      ifButtonFails: 'Se il pulsante non funziona, copia questo link nel browser:',
    },
    fields: {
      plant: 'Impianto',
      part: 'Componente',
      type: 'Tipo',
      operator: 'Operatore',
      priority: 'Priorità',
      plannedDate: 'Data pianificata',
      plannedTime: 'Ora',
      deadline: 'Scadenza',
      comment: 'Commento',
      managerComment: 'Nota del manager',
      reason: 'Motivo della sospensione',
      material: 'Materiale richiesto',
      worker: 'Manutentore',
      author: 'Da',
      message: 'Messaggio',
    },
    passwordReset: {
      subject: 'Reimposta la tua password',
      intro: 'hai richiesto di reimpostare la password del tuo account.',
      cta: 'Reimposta la password',
      note: 'Il link è valido per 1 ora e può essere usato una sola volta. Se non hai richiesto tu il reset, ignora questa email: la tua password resta invariata.',
    },
    accountInvite: {
      subject: 'Attiva il tuo account',
      intro: 'imposta la password del tuo account per accedere.',
      cta: 'Imposta la password',
      note: 'Il link è valido per 7 giorni. Se non ti aspettavi questa email, ignorala.',
    },
    newFault: {
      subject: 'Nuova segnalazione: {faultId}',
      intro: 'È stata creata una nuova segnalazione.',
      cta: 'Apri la segnalazione',
    },
    assignment: {
      subject: 'Nuovo intervento assegnato: {faultId}',
      intro: 'ti è stato assegnato un nuovo intervento.',
      cta: 'Apri l’intervento',
    },
    sicurezzaHse: {
      subject: '[SICUREZZA] Nuova segnalazione: {faultId}',
      intro: 'È stata creata una nuova segnalazione di sicurezza (HSE).',
      cta: 'Apri la segnalazione',
    },
    suspended: {
      subject: 'Intervento sospeso: {faultId}',
      intro: 'l’intervento è stato sospeso da {worker}.',
      cta: 'Apri l’intervento',
    },
    reassign: {
      subject: 'Intervento riassegnato: {faultId}',
      intro: 'non sei più assegnato a questo intervento.',
      cta: 'Apri gli interventi',
    },
    directMessage: {
      subjectWith: '[Syllert] {subject}',
      subjectNo: 'Nuovo messaggio da {author}',
      intro: 'hai ricevuto un nuovo messaggio.',
      cta: 'Apri il messaggio',
    },
  },

  en: {
    common: {
      greeting: 'Hi {name},',
      ifButtonFails: 'If the button doesn’t work, copy this link into your browser:',
    },
    fields: {
      plant: 'Plant',
      part: 'Component',
      type: 'Type',
      operator: 'Operator',
      priority: 'Priority',
      plannedDate: 'Planned date',
      plannedTime: 'Time',
      deadline: 'Deadline',
      comment: 'Comment',
      managerComment: 'Manager note',
      reason: 'Suspension reason',
      material: 'Requested material',
      worker: 'Technician',
      author: 'From',
      message: 'Message',
    },
    passwordReset: {
      subject: 'Reset your password',
      intro: 'you requested to reset your account password.',
      cta: 'Reset password',
      note: 'The link is valid for 1 hour and can be used only once. If you didn’t request this, ignore this email: your password stays unchanged.',
    },
    accountInvite: {
      subject: 'Activate your account',
      intro: 'set the password for your account to sign in.',
      cta: 'Set password',
      note: 'The link is valid for 7 days. If you weren’t expecting this email, ignore it.',
    },
    newFault: {
      subject: 'New report: {faultId}',
      intro: 'A new report has been created.',
      cta: 'Open the report',
    },
    assignment: {
      subject: 'New task assigned: {faultId}',
      intro: 'a new task has been assigned to you.',
      cta: 'Open the task',
    },
    sicurezzaHse: {
      subject: '[SAFETY] New report: {faultId}',
      intro: 'A new safety (HSE) report has been created.',
      cta: 'Open the report',
    },
    suspended: {
      subject: 'Task suspended: {faultId}',
      intro: 'the task has been suspended by {worker}.',
      cta: 'Open the task',
    },
    reassign: {
      subject: 'Task reassigned: {faultId}',
      intro: 'you are no longer assigned to this task.',
      cta: 'Open tasks',
    },
    directMessage: {
      subjectWith: '[Syllert] {subject}',
      subjectNo: 'New message from {author}',
      intro: 'you have received a new message.',
      cta: 'Open the message',
    },
  },

  es: {
    common: {
      greeting: 'Hola {name},',
      ifButtonFails: 'Si el botón no funciona, copia este enlace en el navegador:',
    },
    fields: {
      plant: 'Planta',
      part: 'Componente',
      type: 'Tipo',
      operator: 'Operador',
      priority: 'Prioridad',
      plannedDate: 'Fecha planificada',
      plannedTime: 'Hora',
      deadline: 'Fecha límite',
      comment: 'Comentario',
      managerComment: 'Nota del gerente',
      reason: 'Motivo de la suspensión',
      material: 'Material solicitado',
      worker: 'Técnico',
      author: 'De',
      message: 'Mensaje',
    },
    passwordReset: {
      subject: 'Restablece tu contraseña',
      intro: 'has solicitado restablecer la contraseña de tu cuenta.',
      cta: 'Restablecer contraseña',
      note: 'El enlace es válido durante 1 hora y solo se puede usar una vez. Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.',
    },
    accountInvite: {
      subject: 'Activa tu cuenta',
      intro: 'establece la contraseña de tu cuenta para acceder.',
      cta: 'Establecer contraseña',
      note: 'El enlace es válido durante 7 días. Si no esperabas este correo, ignóralo.',
    },
    newFault: {
      subject: 'Nuevo aviso: {faultId}',
      intro: 'Se ha creado un nuevo aviso.',
      cta: 'Abrir el aviso',
    },
    assignment: {
      subject: 'Nueva intervención asignada: {faultId}',
      intro: 'se te ha asignado una nueva intervención.',
      cta: 'Abrir la intervención',
    },
    sicurezzaHse: {
      subject: '[SEGURIDAD] Nuevo aviso: {faultId}',
      intro: 'Se ha creado un nuevo aviso de seguridad (HSE).',
      cta: 'Abrir el aviso',
    },
    suspended: {
      subject: 'Intervención suspendida: {faultId}',
      intro: 'la intervención ha sido suspendida por {worker}.',
      cta: 'Abrir la intervención',
    },
    reassign: {
      subject: 'Intervención reasignada: {faultId}',
      intro: 'ya no estás asignado a esta intervención.',
      cta: 'Abrir intervenciones',
    },
    directMessage: {
      subjectWith: '[Syllert] {subject}',
      subjectNo: 'Nuevo mensaje de {author}',
      intro: 'has recibido un nuevo mensaje.',
      cta: 'Abrir el mensaje',
    },
  },

  pl: {
    common: {
      greeting: 'Cześć {name},',
      ifButtonFails: 'Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:',
    },
    fields: {
      plant: 'Instalacja',
      part: 'Komponent',
      type: 'Typ',
      operator: 'Operator',
      priority: 'Priorytet',
      plannedDate: 'Data planowana',
      plannedTime: 'Godzina',
      deadline: 'Termin',
      comment: 'Komentarz',
      managerComment: 'Notatka kierownika',
      reason: 'Powód zawieszenia',
      material: 'Zamówiony materiał',
      worker: 'Technik',
      author: 'Od',
      message: 'Wiadomość',
    },
    passwordReset: {
      subject: 'Zresetuj hasło',
      intro: 'poproszono o zresetowanie hasła do Twojego konta.',
      cta: 'Zresetuj hasło',
      note: 'Link jest ważny przez 1 godzinę i można go użyć tylko raz. Jeśli to nie Ty prosiłeś o reset, zignoruj tę wiadomość: hasło pozostanie bez zmian.',
    },
    accountInvite: {
      subject: 'Aktywuj konto',
      intro: 'ustaw hasło do swojego konta, aby się zalogować.',
      cta: 'Ustaw hasło',
      note: 'Link jest ważny przez 7 dni. Jeśli nie spodziewałeś się tej wiadomości, zignoruj ją.',
    },
    newFault: {
      subject: 'Nowe zgłoszenie: {faultId}',
      intro: 'Utworzono nowe zgłoszenie.',
      cta: 'Otwórz zgłoszenie',
    },
    assignment: {
      subject: 'Przydzielono nowe zadanie: {faultId}',
      intro: 'przydzielono Ci nowe zadanie.',
      cta: 'Otwórz zadanie',
    },
    sicurezzaHse: {
      subject: '[BEZPIECZEŃSTWO] Nowe zgłoszenie: {faultId}',
      intro: 'Utworzono nowe zgłoszenie bezpieczeństwa (HSE).',
      cta: 'Otwórz zgłoszenie',
    },
    suspended: {
      subject: 'Zadanie zawieszone: {faultId}',
      intro: 'zadanie zostało zawieszone przez {worker}.',
      cta: 'Otwórz zadanie',
    },
    reassign: {
      subject: 'Zadanie ponownie przypisane: {faultId}',
      intro: 'nie jesteś już przypisany do tego zadania.',
      cta: 'Otwórz zadania',
    },
    directMessage: {
      subjectWith: '[Syllert] {subject}',
      subjectNo: 'Nowa wiadomość od {author}',
      intro: 'otrzymałeś nową wiadomość.',
      cta: 'Otwórz wiadomość',
    },
  },
};
