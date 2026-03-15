// ═══════════════════════════════════════════════════════
//  i18n.js – Internationalization for Money Tracker
//  Supports: English (default), Serbian, Spanish
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  var SETTINGS_KEY = 'mt_settings_v1';

  // ── Language locale map ──
  var localeMap = {
    English: 'en-US',
    Serbian: 'sr-RS',
    Spanish: 'es-ES'
  };

  // ── Translations ──
  var translations = {

    // ═══ SIDEBAR (shared across all pages) ═══
    'sidebar.title':          { en: 'Expense Tracker',   sr: 'Praćenje troškova',   es: 'Rastreador de Gastos' },
    'sidebar.dashboard':      { en: 'Dashboard',         sr: 'Kontrolna tabla',      es: 'Panel' },
    'sidebar.expenses':       { en: 'Expenses',          sr: 'Troškovi',             es: 'Gastos' },
    'sidebar.spendings':      { en: 'Spendings',         sr: 'Potrošnja',            es: 'Gastos' },
    'sidebar.familyBudget':   { en: 'Family Budget',     sr: 'Porodični budžet',     es: 'Presupuesto Familiar' },
    'sidebar.thisMonth':      { en: 'This Month',        sr: 'Ovaj mesec',           es: 'Este Mes' },
    'sidebar.spent':          { en: 'Spent',             sr: 'Potrošeno',            es: 'Gastado' },
    'sidebar.remaining':      { en: 'Remaining',         sr: 'Preostalo',            es: 'Restante' },
    'sidebar.settings':       { en: 'Settings',          sr: 'Podešavanja',          es: 'Configuración' },

    // ═══ DASHBOARD ═══
    'dash.monthlyOverview':   { en: 'Monthly Overview',  sr: 'Mesečni pregled',      es: 'Resumen Mensual' },
    'dash.totalSpent':        { en: 'Total Spent',       sr: 'Ukupno potrošeno',     es: 'Total Gastado' },
    'dash.income':            { en: 'Income',            sr: 'Prihod',               es: 'Ingresos' },
    'dash.balance':           { en: 'Balance',           sr: 'Stanje',               es: 'Balance' },
    'dash.spendingThisMonth': { en: 'Spending this month', sr: 'Potrošnja ovog meseca', es: 'Gastos este mes' },
    'dash.insights':          { en: 'Insights',          sr: 'Uvidi',                es: 'Perspectivas' },
    'dash.transactionTags':   { en: 'Transaction Tags',   sr: 'Tagovi transakcija',   es: 'Etiquetas' },
    'dash.allTags':           { en: 'All',               sr: 'Sve',                  es: 'Todo' },
    'dash.recentTx':          { en: 'Recent Transactions', sr: 'Nedavne transakcije', es: 'Transacciones Recientes' },
    'dash.limits':            { en: 'Limits',            sr: 'Limiti',               es: 'Límites' },
    'dash.editLimits':        { en: 'Edit Limits',       sr: 'Izmeni limite',        es: 'Editar Límites' },
    'dash.showAll':           { en: 'Show all',          sr: 'Prikaži sve',          es: 'Mostrar todo' },
    'dash.dailySpending':     { en: 'Daily Spending (This Month)', sr: 'Dnevna potrošnja (ovaj mesec)', es: 'Gastos Diarios (Este Mes)' },
    'dash.comparison':        { en: 'Comparison: This vs Last Month', sr: 'Poređenje: Ovaj vs prošli mesec', es: 'Comparación: Este vs Mes Pasado' },
    'dash.addExpense':        { en: 'Add Expense',       sr: 'Dodaj trošak',         es: 'Agregar Gasto' },
    'dash.amount':            { en: 'Amount',            sr: 'Iznos',                es: 'Monto' },
    'dash.category':          { en: 'Category',          sr: 'Kategorija',           es: 'Categoría' },
    'dash.tagsPlaceholder':   { en: 'Tags (e.g. #coffee, #work, #travel)', sr: 'Tagovi (npr. #kafa, #posao, #putovanje)', es: 'Etiquetas (ej. #café, #trabajo, #viaje)' },
    'dash.addExpenseBtn':     { en: 'Add Expense',       sr: 'Dodaj trošak',         es: 'Agregar Gasto' },
    'dash.addSavings':        { en: 'Add Savings',       sr: 'Dodaj ušteđevinu',     es: 'Agregar Ahorros' },
    'dash.addMoney':          { en: 'Add Money',         sr: 'Dodaj novac',          es: 'Agregar Dinero' },
    'dash.trackLimits':       { en: 'Track Limits',      sr: 'Praćenje limita',      es: 'Seguir Límites' },
    'dash.resetAll':          { en: 'Reset All',         sr: 'Resetuj sve',          es: 'Restablecer Todo' },
    'dash.spendingByCat':     { en: 'Spending by Category', sr: 'Potrošnja po kategoriji', es: 'Gastos por Categoría' },
    'dash.spendingCalendar':  { en: 'Spending Calendar', sr: 'Kalendar potrošnje',   es: 'Calendario de Gastos' },
    'dash.topSpendingDays':   { en: 'Top Spending Days', sr: 'Dani sa najviše troškova', es: 'Días de Mayor Gasto' },
    'dash.recurringExpenses': { en: 'Recurring Expenses', sr: 'Ponavljajući troškovi',  es: 'Gastos Recurrentes' },
    'dash.recurringDesc':     { en: 'Automatically added every month', sr: 'Automatski se dodaju svakog meseca', es: 'Se agregan automáticamente cada mes' },
    'dash.recurringName':     { en: 'Name (Rent, Netflix, Internet...)', sr: 'Naziv (Kirija, Netflix, Internet...)', es: 'Nombre (Alquiler, Netflix, Internet...)' },
    'dash.recurringAmount':   { en: 'Amount',            sr: 'Iznos',                es: 'Monto' },
    'dash.addRecurring':      { en: 'Add Recurring',     sr: 'Dodaj ponavljajući',   es: 'Agregar Recurrente' },
    'dash.smartSuggestions':  { en: 'Smart Suggestions',  sr: 'Pametni predlozi',     es: 'Sugerencias Inteligentes' },
    'dash.weRecommend':       { en: 'We recommend:',     sr: 'Preporučujemo:',       es: 'Recomendamos:' },
    'dash.analyzingSpending': { en: 'Analyzing your spending...', sr: 'Analiziramo tvoju potrošnju...', es: 'Analizando tus gastos...' },
    'dash.openMonth':         { en: 'Open Month',        sr: 'Otvori mesec',         es: 'Abrir Mes' },
    'dash.addCategory':       { en: '+ Add category',    sr: '+ Dodaj kategoriju',   es: '+ Agregar categoría' },

    // Dashboard – Onboarding Modal
    'dash.welcomeTitle':      { en: 'Welcome to Money Tracker!', sr: 'Dobrodošli u Money Tracker!', es: '¡Bienvenido a Money Tracker!' },
    'dash.welcomeDesc':       { en: "Let's set up your account to start tracking your expenses effectively.", sr: 'Hajde da podesimo tvoj nalog za efikasno praćenje troškova.', es: 'Configuremos tu cuenta para comenzar a rastrear tus gastos.' },
    'dash.fullName':          { en: 'Full Name',         sr: 'Puno ime',             es: 'Nombre Completo' },
    'dash.monthlyIncome':     { en: 'Monthly Income',    sr: 'Mesečni prihod',       es: 'Ingreso Mensual' },
    'dash.monthlyIncomePlc':  { en: 'e.g., 100000',      sr: 'npr. 100000',          es: 'ej. 100000' },
    'dash.yourIncome':        { en: 'Your regular monthly income', sr: 'Tvoj redovni mesečni prihod', es: 'Tu ingreso mensual regular' },
    'dash.currentBalance':    { en: 'Current Balance',   sr: 'Trenutni saldo',       es: 'Saldo Actual' },
    'dash.currentBalancePlc': { en: 'e.g., 50000',       sr: 'npr. 50000',           es: 'ej. 50000' },
    'dash.howMuchNow':        { en: 'How much money you have right now', sr: 'Koliko novca trenutno imaš', es: 'Cuánto dinero tienes ahora' },
    'dash.completeSetup':     { en: 'Complete Setup',    sr: 'Završi podešavanje',   es: 'Completar Configuración' },

    // Dashboard – Spendings Modal
    'dash.spendingsTitle':    { en: 'Spendings',         sr: 'Potrošnja',            es: 'Gastos' },
    'dash.total':             { en: 'Total',             sr: 'Ukupno',               es: 'Total' },
    'dash.topCategory':       { en: 'Top Category',      sr: 'Top kategorija',       es: 'Categoría Principal' },
    'dash.transactions':      { en: 'Transactions',      sr: 'Transakcije',          es: 'Transacciones' },
    'dash.from':              { en: 'From',              sr: 'Od',                   es: 'Desde' },
    'dash.to':                { en: 'To',                sr: 'Do',                   es: 'Hasta' },
    'dash.categories':        { en: 'Categories',        sr: 'Kategorije',           es: 'Categorías' },
    'dash.latestTx':          { en: 'Latest Transactions', sr: 'Poslednje transakcije', es: 'Últimas Transacciones' },
    'dash.all':               { en: 'All',               sr: 'Sve',                  es: 'Todo' },

    // ═══ EXPENSES PAGE ═══
    'exp.title':              { en: 'Expenses Management', sr: 'Upravljanje troškovima', es: 'Gestión de Gastos' },
    'exp.addNew':             { en: 'Add New Expense',   sr: 'Dodaj novi trošak',    es: 'Agregar Nuevo Gasto' },
    'exp.filterByCat':        { en: 'Filter by Category:', sr: 'Filtriraj po kategoriji:', es: 'Filtrar por Categoría:' },
    'exp.allCategories':      { en: 'All Categories',    sr: 'Sve kategorije',       es: 'Todas las Categorías' },
    'exp.sortBy':             { en: 'Sort by:',          sr: 'Sortiraj po:',         es: 'Ordenar por:' },
    'exp.dateNewest':         { en: 'Date (Newest First)', sr: 'Datum (najnovije)',   es: 'Fecha (Más Reciente)' },
    'exp.dateOldest':         { en: 'Date (Oldest First)', sr: 'Datum (najstarije)',  es: 'Fecha (Más Antiguo)' },
    'exp.amountHigh':         { en: 'Amount (High to Low)', sr: 'Iznos (od najvišeg)', es: 'Monto (Mayor a Menor)' },
    'exp.amountLow':          { en: 'Amount (Low to High)', sr: 'Iznos (od najnižeg)', es: 'Monto (Menor a Mayor)' },
    'exp.search':             { en: 'Search:',           sr: 'Pretraži:',            es: 'Buscar:' },
    'exp.searchPlaceholder':  { en: 'Search expenses...', sr: 'Pretraži troškove...', es: 'Buscar gastos...' },
    'exp.kpiSummary':         { en: 'KPI Summary',       sr: 'KPI pregled',          es: 'Resumen KPI' },
    'exp.monthlyBudget':      { en: 'Monthly Budget',    sr: 'Mesečni budžet',       es: 'Presupuesto Mensual' },
    'exp.spendingByCat':      { en: 'Spending by Category', sr: 'Potrošnja po kategoriji', es: 'Gastos por Categoría' },
    'exp.smartInsights':      { en: 'Smart Insights',    sr: 'Pametni uvidi',        es: 'Perspectivas Inteligentes' },
    'exp.exportCSV':          { en: 'Export CSV',        sr: 'Izvezi CSV',           es: 'Exportar CSV' },
    'exp.importCSV':          { en: 'Import CSV',        sr: 'Uvezi CSV',            es: 'Importar CSV' },
    'exp.modalTitle':         { en: 'Add New Expense',   sr: 'Dodaj novi trošak',    es: 'Agregar Nuevo Gasto' },
    'exp.amountLabel':        { en: 'Amount:',           sr: 'Iznos:',               es: 'Monto:' },
    'exp.categoryLabel':      { en: 'Category:',         sr: 'Kategorija:',          es: 'Categoría:' },
    'exp.descriptionLabel':   { en: 'Description:',      sr: 'Opis:',                es: 'Descripción:' },
    'exp.dateLabel':          { en: 'Date:',             sr: 'Datum:',               es: 'Fecha:' },
    'exp.tagsLabel':          { en: 'Tags (optional, comma-separated):', sr: 'Tagovi (opciono, odvojeni zarezom):', es: 'Etiquetas (opcional, separadas por coma):' },
    'exp.tagsPlaceholder':    { en: 'e.g. urgent, work', sr: 'npr. hitno, posao',    es: 'ej. urgente, trabajo' },
    'exp.saveExpense':        { en: 'Save Expense',      sr: 'Sačuvaj trošak',       es: 'Guardar Gasto' },
    'exp.cancel':             { en: 'Cancel',            sr: 'Otkaži',               es: 'Cancelar' },
    'exp.viewingWallet':      { en: 'Viewing wallet transactions for', sr: 'Pregled transakcija za novčanik', es: 'Viendo transacciones de billetera para' },
    'exp.clear':              { en: 'Clear',             sr: 'Obriši',               es: 'Limpiar' },
    'exp.budgetStatus':       { en: 'Budget Status',     sr: 'Status budžeta',       es: 'Estado del Presupuesto' },

    // ═══ SHARED / FAMILY BUDGET ═══
    'shared.welcomeBack':     { en: 'Welcome back',      sr: 'Dobrodošli nazad',     es: 'Bienvenido de vuelta' },
    'shared.loginDesc':       { en: 'Log in to manage shared budgets.', sr: 'Prijavi se da upravljaš zajedničkim budžetima.', es: 'Inicia sesión para gestionar presupuestos compartidos.' },
    'shared.login':           { en: 'Login',             sr: 'Prijava',              es: 'Iniciar Sesión' },
    'shared.createAccount':   { en: 'Create account',    sr: 'Napravi nalog',        es: 'Crear Cuenta' },
    'shared.email':           { en: 'Email',             sr: 'Email',                es: 'Correo' },
    'shared.password':        { en: 'Password',          sr: 'Lozinka',              es: 'Contraseña' },
    'shared.fullName':        { en: 'Full name',         sr: 'Puno ime',             es: 'Nombre completo' },
    'shared.loginBtn':        { en: 'Login',             sr: 'Prijavi se',           es: 'Iniciar Sesión' },
    'shared.createAccountBtn': { en: 'Create account',   sr: 'Napravi nalog',        es: 'Crear Cuenta' },
    'shared.kicker':          { en: 'Shared / Family Budgets', sr: 'Zajednički / Porodični budžeti', es: 'Presupuestos Compartidos / Familiares' },
    'shared.heroTitle':       { en: 'Family Budget',     sr: 'Porodični budžet',     es: 'Presupuesto Familiar' },
    'shared.heroDesc':        { en: 'Invite people, create shared wallets, and split expenses in one place.', sr: 'Pozovi ljude, kreiraj zajedničke novčanike i podeli troškove na jednom mestu.', es: 'Invita personas, crea billeteras compartidas y divide gastos en un solo lugar.' },
    'shared.invite':          { en: 'Invite',            sr: 'Pozovi',               es: 'Invitar' },
    'shared.createWallet':    { en: 'Create Wallet',     sr: 'Kreiraj novčanik',     es: 'Crear Billetera' },
    'shared.invitePeople':    { en: 'Invite People',     sr: 'Pozovi ljude',         es: 'Invitar Personas' },
    'shared.invitePeopleDesc': { en: 'Add family members and set roles for visibility and access.', sr: 'Dodaj članove porodice i podesi uloge za vidljivost i pristup.', es: 'Agrega miembros de familia y establece roles de visibilidad y acceso.' },
    'shared.sendInvite':      { en: 'Send Invite',       sr: 'Pošalji poziv',        es: 'Enviar Invitación' },
    'shared.wallets':         { en: 'Wallets',           sr: 'Novčanici',            es: 'Billeteras' },
    'shared.walletsDesc':     { en: 'Track multiple shared wallets with clear monthly goals.', sr: 'Prati više zajedničkih novčanika sa jasnim mesečnim ciljevima.', es: 'Rastrea múltiples billeteras compartidas con metas mensuales claras.' },
    'shared.newWallet':       { en: 'New Wallet',        sr: 'Novi novčanik',        es: 'Nueva Billetera' },
    'shared.splitExpenses':   { en: 'Split Expenses',    sr: 'Podeli troškove',      es: 'Dividir Gastos' },
    'shared.splitDesc':       { en: 'Split bills evenly or by custom ratios per person.', sr: 'Podeli račune ravnomerno ili po prilagođenim odnosima po osobi.', es: 'Divide facturas equitativamente o por proporciones personalizadas por persona.' },
    'shared.splitBill':       { en: 'Split Bill',        sr: 'Podeli račun',         es: 'Dividir Cuenta' },
    'shared.invites':         { en: 'Invites',           sr: 'Pozivnice',            es: 'Invitaciones' },
    'shared.newInvite':       { en: 'New Invite',        sr: 'Novi poziv',           es: 'Nueva Invitación' },
    'shared.friends':         { en: 'Friends',           sr: 'Prijatelji',           es: 'Amigos' },
    'shared.friendsHint':     { en: 'Accepted invites appear here.', sr: 'Prihvaćene pozivnice se pojavljuju ovde.', es: 'Las invitaciones aceptadas aparecen aquí.' },
    'shared.newSplit':        { en: 'New Split',         sr: 'Nova podela',          es: 'Nueva División' },
    'shared.viewAll':         { en: 'View All',          sr: 'Prikaži sve',          es: 'Ver Todo' },
    'shared.allSplits':       { en: 'All Splits',        sr: 'Sve podele',           es: 'Todas las Divisiones' },

    // Shared modals
    'shared.newItem':         { en: 'New Item',          sr: 'Nova stavka',          es: 'Nuevo Elemento' },
    'shared.name':            { en: 'Name',              sr: 'Naziv',                es: 'Nombre' },
    'shared.nameTooltip':     { en: 'Name of the wallet you are creating.', sr: 'Naziv novčanika koji kreiraš.', es: 'Nombre de la billetera que estás creando.' },
    'shared.emailTooltip':    { en: 'Invite email for the person you want to add.', sr: 'Email pozivnice za osobu koju želiš da dodaš.', es: 'Correo de invitación para la persona que deseas agregar.' },
    'shared.amountTooltip':   { en: 'Starting balance or initial amount for the wallet.', sr: 'Početni saldo ili početni iznos za novčanik.', es: 'Saldo inicial o monto inicial para la billetera.' },
    'shared.goalTooltip':     { en: 'Target amount you want to reach for this wallet.', sr: 'Ciljni iznos koji želiš da dostigneš za ovaj novčanik.', es: 'Monto objetivo que deseas alcanzar para esta billetera.' },
    'shared.capTooltip':      { en: 'Maximum allowed spending for this wallet per month.', sr: 'Maksimalna dozvoljena potrošnja za ovaj novčanik mesečno.', es: 'Gasto máximo permitido para esta billetera por mes.' },
    'shared.deadlineTooltip': { en: 'Optional target date for reaching the goal.', sr: 'Opcioni rok za dostizanje cilja.', es: 'Fecha objetivo opcional para alcanzar la meta.' },
    'shared.membersTooltip':  { en: 'People who contribute to or track this wallet.', sr: 'Osobe koje doprinose ili prate ovaj novčanik.', es: 'Personas que contribuyen o rastrean esta billetera.' },
    'shared.membersAmounts':  { en: 'Members & Amounts', sr: 'Članovi i iznosi',     es: 'Miembros y Montos' },
    'shared.splitAmountTooltip': { en: 'Specify how much each person owes in this split.', sr: 'Navedi koliko svaka osoba duguje u ovoj podeli.', es: 'Especifica cuánto debe cada persona en esta división.' },
    'shared.addFriend':       { en: '+ Add Friend',      sr: '+ Dodaj prijatelja',   es: '+ Agregar Amigo' },
    'shared.recurringMonthly': { en: 'Recurring (monthly)', sr: 'Ponavljajuće (mesečno)', es: 'Recurrente (mensual)' },
    'shared.recurringTooltip': { en: 'Enable this for recurring bills like rent or Netflix.', sr: 'Omogući ovo za ponavljajuće račune kao što su kirija ili Netflix.', es: 'Habilita esto para facturas recurrentes como alquiler o Netflix.' },
    'shared.categoriesLabel': { en: 'Categories (comma separated)', sr: 'Kategorije (odvojene zarezom)', es: 'Categorías (separadas por coma)' },
    'shared.categoriesTooltip': { en: 'Spending categories you want to track in this wallet.', sr: 'Kategorije potrošnje koje želiš da pratiš u ovom novčaniku.', es: 'Categorías de gasto que deseas rastrear en esta billetera.' },
    'shared.notesLabel':      { en: 'Notes',             sr: 'Napomene',             es: 'Notas' },
    'shared.notesTooltip':    { en: 'Short description or context for this wallet.', sr: 'Kratak opis ili kontekst za ovaj novčanik.', es: 'Breve descripción o contexto para esta billetera.' },
    'shared.save':            { en: 'Save',              sr: 'Sačuvaj',              es: 'Guardar' },
    'shared.cancel':          { en: 'Cancel',            sr: 'Otkaži',               es: 'Cancelar' },
    'shared.confirmAction':   { en: 'Confirm action',    sr: 'Potvrdi akciju',       es: 'Confirmar acción' },
    'shared.areYouSure':      { en: 'Are you sure?',     sr: 'Da li si siguran?',    es: '¿Estás seguro?' },
    'shared.yesRemove':       { en: 'Yes, remove',       sr: 'Da, ukloni',           es: 'Sí, eliminar' },
    'shared.input':           { en: 'Input',             sr: 'Unos',                 es: 'Entrada' },
    'shared.enterValue':      { en: 'Enter value:',      sr: 'Unesi vrednost:',      es: 'Ingresa valor:' },
    'shared.ok':              { en: 'OK',                sr: 'OK',                   es: 'OK' },
    'shared.amount':          { en: 'Amount',            sr: 'Iznos',                es: 'Monto' },
    'shared.goal':            { en: 'Goal',              sr: 'Cilj',                 es: 'Meta' },
    'shared.monthlyCap':      { en: 'Monthly cap',       sr: 'Mesečni limit',        es: 'Límite Mensual' },
    'shared.deadline':        { en: 'Deadline',          sr: 'Rok',                  es: 'Fecha Límite' },
    'shared.members':         { en: 'Members (comma separated)', sr: 'Članovi (odvojeni zarezom)', es: 'Miembros (separados por coma)' },

    // ═══ SETTINGS ═══
    'settings.title':         { en: 'Settings',          sr: 'Podešavanja',          es: 'Configuración' },
    'settings.subtitle':      { en: 'Manage your account, preferences, and security', sr: 'Upravljaj nalogom, preferencama i bezbednošću', es: 'Administra tu cuenta, preferencias y seguridad' },
    'settings.saveChanges':   { en: 'Save Changes',      sr: 'Sačuvaj izmene',       es: 'Guardar Cambios' },
    'settings.changePhoto':   { en: 'Change photo',      sr: 'Promeni sliku',        es: 'Cambiar foto' },
    'settings.fullName':      { en: 'Full name',         sr: 'Puno ime',             es: 'Nombre completo' },
    'settings.email':         { en: 'Email',             sr: 'Email',                es: 'Correo' },
    'settings.username':      { en: 'Username',          sr: 'Korisničko ime',       es: 'Nombre de usuario' },
    'settings.saveProfile':   { en: 'Save Profile',      sr: 'Sačuvaj profil',       es: 'Guardar Perfil' },
    'settings.accountSecurity': { en: 'Account & Security', sr: 'Nalog i bezbednost', es: 'Cuenta y Seguridad' },
    'settings.currentPassword': { en: 'Current password', sr: 'Trenutna lozinka',    es: 'Contraseña actual' },
    'settings.newPassword':   { en: 'New password',      sr: 'Nova lozinka',         es: 'Nueva contraseña' },
    'settings.confirmPassword': { en: 'Confirm password', sr: 'Potvrdi lozinku',     es: 'Confirmar contraseña' },
    'settings.currentPassPlc': { en: 'Enter current password', sr: 'Unesi trenutnu lozinku', es: 'Ingresa contraseña actual' },
    'settings.newPassPlc':    { en: 'Min 6 characters',  sr: 'Min 6 karaktera',      es: 'Mín 6 caracteres' },
    'settings.confirmPassPlc': { en: 'Repeat new password', sr: 'Ponovi novu lozinku', es: 'Repite nueva contraseña' },
    'settings.changePassword': { en: 'Change Password',  sr: 'Promeni lozinku',      es: 'Cambiar Contraseña' },
    'settings.twoFactor':     { en: 'Two-Factor Authentication', sr: 'Dvofaktorska autentifikacija', es: 'Autenticación de Dos Factores' },
    'settings.activeSessions': { en: 'Active Sessions',  sr: 'Aktivne sesije',       es: 'Sesiones Activas' },
    'settings.notifications': { en: 'Notifications',     sr: 'Obaveštenja',          es: 'Notificaciones' },
    'settings.notifExpense':  { en: 'Expense added',     sr: 'Trošak dodat',         es: 'Gasto agregado' },
    'settings.notifMonthly':  { en: 'Monthly limit reached', sr: 'Mesečni limit dostignut', es: 'Límite mensual alcanzado' },
    'settings.notifFamily':   { en: 'Family invite received', sr: 'Porodična pozivnica primljena', es: 'Invitación familiar recibida' },
    'settings.notifWallet':   { en: 'Wallet updates',    sr: 'Ažuriranja novčanika', es: 'Actualizaciones de billetera' },
    'settings.notifWeekly':   { en: 'Weekly summary email', sr: 'Nedeljni pregled email', es: 'Correo resumen semanal' },
    'settings.preferences':   { en: 'Preferences',       sr: 'Preference',           es: 'Preferencias' },
    'settings.monthlyIncome': { en: 'Monthly Income',    sr: 'Mesečni prihod',       es: 'Ingreso Mensual' },
    'settings.defaultCurrency': { en: 'Default Currency', sr: 'Podrazumevana valuta', es: 'Moneda Predeterminada' },
    'settings.dateFormat':    { en: 'Date Format',       sr: 'Format datuma',        es: 'Formato de Fecha' },
    'settings.payDay':        { en: 'PayDay',            sr: 'Dan plate',            es: 'Día de Pago' },
    'settings.language':      { en: 'Language',          sr: 'Jezik',                es: 'Idioma' },
    'settings.appearance':    { en: 'Appearance',        sr: 'Izgled',               es: 'Apariencia' },
    'settings.theme':         { en: 'Theme',             sr: 'Tema',                 es: 'Tema' },
    'settings.light':         { en: 'Light',             sr: 'Svetla',               es: 'Claro' },
    'settings.dark':          { en: 'Dark',              sr: 'Tamna',                es: 'Oscuro' },
    'settings.system':        { en: 'System',            sr: 'Sistemska',            es: 'Sistema' },
    'settings.accentColor':   { en: 'Accent Color',      sr: 'Boja akcenta',         es: 'Color de Acento' },
    'settings.dangerZone':    { en: 'Danger Zone',       sr: 'Opasna zona',          es: 'Zona de Peligro' },
    'settings.leaveFamily':   { en: 'Leave Family Budget', sr: 'Napusti porodični budžet', es: 'Abandonar Presupuesto Familiar' },
    'settings.deleteAccount': { en: 'Delete Account',    sr: 'Obriši nalog',         es: 'Eliminar Cuenta' },
    'settings.lastDay':       { en: 'Last day',          sr: 'Poslednji dan',        es: 'Último día' },

    // ═══ FOOTER ═══
    'footer.title':           { en: 'Money Tracker',     sr: 'Money Tracker',        es: 'Money Tracker' },
    'footer.desc':            { en: 'Smart expense tracking for better financial management', sr: 'Pametno praćenje troškova za bolje upravljanje finansijama', es: 'Seguimiento inteligente de gastos para una mejor gestión financiera' },
    'footer.features':        { en: 'Features',          sr: 'Funkcije',             es: 'Características' },
    'footer.budgetTracking':  { en: 'Budget Tracking',    sr: 'Praćenje budžeta',     es: 'Seguimiento de Presupuesto' },
    'footer.tagManagement':   { en: 'Tag Management',     sr: 'Upravljanje tagovima', es: 'Gestión de Etiquetas' },
    'footer.recurringExp':    { en: 'Recurring Expenses', sr: 'Ponavljajući troškovi', es: 'Gastos Recurrentes' },
    'footer.smartSuggestions': { en: 'Smart Suggestions', sr: 'Pametni predlozi',     es: 'Sugerencias Inteligentes' },
    'footer.info':            { en: 'Info',              sr: 'Info',                 es: 'Info' },

    // ═══ DYNAMIC JS STRINGS ═══
    'js.noDataForFilters':    { en: 'No data for selected filters.', sr: 'Nema podataka za izabrane filtere.', es: 'No hay datos para los filtros seleccionados.' },
    'js.noTxForFilters':      { en: 'No transactions for selected filters.', sr: 'Nema transakcija za izabrane filtere.', es: 'No hay transacciones para los filtros seleccionados.' },
    'js.savingsAdded':        { en: '✅ Savings added: ', sr: '✅ Ušteda dodana: ',   es: '✅ Ahorros agregados: ' },
    'js.spendMostWeekends':   { en: 'You spend the most on weekends', sr: 'Najviše trošiš vikendom', es: 'Gastas más los fines de semana' },
    'js.spendMostWeekdays':   { en: 'You spend the most on weekdays', sr: 'Najviše trošiš radnim danima', es: 'Gastas más entre semana' },
    'js.entertainmentSame':   { en: 'Entertainment is the same as last month', sr: 'Entertainment ti je isti kao prošli mesec', es: 'Entretenimiento es igual al mes pasado' },
    'js.entertainmentChange': { en: 'Entertainment is {0} compared to last month', sr: 'Entertainment je {0} u odnosu na prošli mesec', es: 'Entretenimiento es {0} comparado con el mes pasado' },
    'js.entertainmentNew':    { en: 'Entertainment is a new expense this month', sr: 'Entertainment ti je novi trošak ovog meseca', es: 'Entretenimiento es un gasto nuevo este mes' },
    'js.top3Transactions':    { en: 'Top 3 largest transactions – ', sr: 'Top 3 najveće transakcije – ', es: 'Top 3 transacciones más grandes – ' },
    'js.noExpensesThisMonth': { en: 'No expenses this month', sr: 'Nema troškova ovaj mesec', es: 'Sin gastos este mes' },
    'js.savingsPrediction':   { en: 'If you continue at this pace, you\'ll save ~{0}', sr: 'Ako nastaviš ovim tempom, uštedećeš ~{0}', es: 'Si continúas a este ritmo, ahorrarás ~{0}' },
    'js.dayLabel':            { en: 'Day {0}',           sr: '{0}. dan',             es: 'Día {0}' },
    'js.noExpenses':          { en: 'No expenses',       sr: 'Nema troškova',        es: 'Sin gastos' },
    'js.saved':               { en: '💰 Saved: {0}',     sr: '💰 Uštedeo: {0}',      es: '💰 Ahorrado: {0}' },
    'js.overspent':           { en: '💸 Overspent: {0}',  sr: '💸 Potrošio više: {0}', es: '💸 Gastado de más: {0}' },
    'js.totalSpent':          { en: 'Total spent: {0}',  sr: 'Ukupno potrošeno: {0}', es: 'Total gastado: {0}' },
    'js.noExpensesYet':       { en: 'No expenses yet',   sr: 'Nema troškova još uvek', es: 'Aún sin gastos' },
    'js.totalMost':           { en: 'Total: {0} - Most: ', sr: 'Ukupno: {0} - Najviše: ', es: 'Total: {0} - Mayor: ' },
    'js.thisMonth':           { en: 'This month',        sr: 'Ovaj mesec',           es: 'Este mes' },
    'js.lastMonth':           { en: 'Last month',        sr: 'Prošli mesec',         es: 'Mes pasado' },
    'js.spentPercent':        { en: 'You\'ve spent {0}% of {1} budget', sr: 'Potrošio si {0}% {1} budžeta', es: 'Has gastado {0}% del presupuesto de {1}' },
    'js.fillNameAmount':      { en: 'Please fill in name and amount!', sr: 'Popuni naziv i iznos!', es: '¡Completa el nombre y el monto!' },
    'js.deleteRecurring':     { en: 'Delete this recurring expense?', sr: 'Obrisati ovaj recurring trošak?', es: '¿Eliminar este gasto recurrente?' },
    'js.noRecurring':         { en: 'No recurring expenses', sr: 'Nema ponavljajućih troškova', es: 'Sin gastos recurrentes' },
    'js.recurringPercent':    { en: 'Recurring expenses make up {0}% of monthly spending', sr: 'Ponavljajući troškovi čine {0}% mesečne potrošnje', es: 'Los gastos recurrentes representan {0}% del gasto mensual' },
    'js.tagCosts':            { en: '{0} costs you {1} monthly {2}', sr: '{0} te košta {1} mesečno {2}', es: '{0} te cuesta {1} mensualmente {2}' },
    'js.noDataForSuggestions': { en: 'Not enough data for suggestions', sr: 'Nema dovoljno podataka za sugestije', es: 'No hay suficientes datos para sugerencias' },
    'js.showLess':             { en: 'Show less',             sr: 'Prikaži manje',         es: 'Mostrar menos' },
    'js.reduceSuggestion':    { en: 'If you reduce {0} by 20%, you\'ll save ~{1}', sr: 'Ako smanjiš {0} za 20%, uštedećeš ~{1}', es: 'Si reduces {0} un 20%, ahorrarás ~{1}' },
    'js.aboveRecommended':    { en: '{0} is above the recommended 30% of income ({1}%)', sr: '{0} ti je iznad preporučenih 30% prihoda ({1}%)', es: '{0} supera el 30% recomendado de ingresos ({1}%)' },
    'js.spendingTooHigh':     { en: 'You\'re spending {0}% of your income - try to reduce to 70%', sr: 'Trošiš {0}% svojih prihoda - pokušaj da smanjiš na 70%', es: 'Estás gastando {0}% de tus ingresos - intenta reducir al 70%' },
    'js.savingsGoal':         { en: 'Try to save {0} more to reach 20% of income', sr: 'Pokušaj da uštediš još {0} da dostigneš 20% prihoda', es: 'Intenta ahorrar {0} más para alcanzar el 20% de ingresos' },
    'js.recurringTooHigh':    { en: '{0}% of expenses are recurring - consider reducing subscriptions', sr: '{0}% troškova su recurring - razmisli o smanjenju pretplata', es: '{0}% de los gastos son recurrentes - considera reducir suscripciones' },
    'js.addAllRecurring':     { en: 'Add all recurring for new month', sr: 'Dodaj sve ponavljajuće za novi mesec', es: 'Agregar todos los recurrentes para el nuevo mes' },
    'js.removeMemberConfirm': { en: 'Are you sure you want to remove {0} from this wallet?', sr: 'Da li si siguran da želiš da ukloniš {0} iz ovog novčanika?', es: '¿Estás seguro de que deseas eliminar a {0} de esta billetera?' },

    // ═══ CATEGORY NAMES ═══
    'cat.food':          { en: 'Food',          sr: 'Hrana',          es: 'Comida' },
    'cat.transport':     { en: 'Transport',      sr: 'Prevoz',         es: 'Transporte' },
    'cat.rent':          { en: 'Rent',           sr: 'Kirija',         es: 'Alquiler' },
    'cat.entertainment': { en: 'Entertainment',  sr: 'Zabava',         es: 'Entretenimiento' },
    'cat.shopping':      { en: 'Shopping',       sr: 'Kupovina',       es: 'Compras' },
    'cat.health':        { en: 'Health',         sr: 'Zdravlje',       es: 'Salud' },
    'cat.utilities':     { en: 'Utilities',      sr: 'Komunalije',     es: 'Servicios' },
    'cat.savings':       { en: 'Savings',        sr: 'Uštedevina',     es: 'Ahorros' },
    'cat.income':        { en: 'Income',         sr: 'Prihod',         es: 'Ingreso' },
    'cat.other':         { en: 'Other',          sr: 'Ostalo',         es: 'Otro' },

    // ═══ ANALYTICS / SMART INSIGHTS ═══
    'analytics.budgetExceeded':   { en: '⚠️ Budget exceeded!',           sr: '⚠️ Budžet prekoračen!',              es: '⚠️ ¡Presupuesto superado!' },
    'analytics.budgetLow':        { en: '⚠️ Only {0} remaining',          sr: '⚠️ Samo {0} preostalo',              es: '⚠️ Solo {0} restante' },
    'analytics.budgetWarning':    { en: '⚡ {0} remaining',               sr: '⚡ {0} preostalo',                   es: '⚡ {0} restante' },
    'analytics.budgetOk':         { en: '✓ {0} remaining',               sr: '✓ {0} preostalo',                   es: '✓ {0} restante' },
    'analytics.recurringTitle':   { en: 'Recurring Subscriptions',       sr: 'Ponavljajuće pretplate',             es: 'Suscripciones Recurrentes' },
    'analytics.recurringDesc':    { en: 'Found {0} subscription(s) costing {1} this month. Review to save money.', sr: 'Pronađeno {0} pretplata koje koštaju {1} ovog meseca. Pregled radi uštede.', es: 'Se encontraron {0} suscripción(es) con costo de {1} este mes. Revisa para ahorrar.' },
    'analytics.highSpendingTitle':{ en: 'High {0} Spending',             sr: 'Visoka potrošnja na {0}',            es: 'Alto gasto en {0}' },
    'analytics.highSpendingDesc': { en: '{0} accounts for {1}% of your spending ({2}). Consider reducing expenses in this category.', sr: '{0} čini {1}% vaše potrošnje ({2}). Razmotrite smanjenje troškova u ovoj kategoriji.', es: '{0} representa el {1}% de tus gastos ({2}). Considera reducir gastos en esta categoría.' },
    'analytics.onTrackTitle':     { en: 'On Track!',                     sr: 'Na pravom putu!',                   es: '¡En buen camino!' },
    'analytics.onTrackDesc':      { en: "You've spent {0}% of your budget. Keep up the good spending habits!", sr: 'Potrošili ste {0}% budžeta. Nastavite sa dobrim navikama potrošnje!', es: 'Has gastado el {0}% de tu presupuesto. ¡Sigue con los buenos hábitos de gasto!' },
    'analytics.saveMoreTitle':    { en: 'Save More',                     sr: 'Uštedi više',                       es: 'Ahorra Más' },
    'analytics.saveMoreDesc':     { en: 'You have room in your budget. Consider moving {0} to savings.', sr: 'Imate prostora u budžetu. Razmotrite premještanje {0} u uštedinu.', es: 'Tienes margen en tu presupuesto. Considera mover {0} a ahorros.' },
    'analytics.noInsights':       { en: 'No insights available yet. Add more expenses to get personalized recommendations.', sr: 'Nema uvida još uvek. Dodajte više troškova za personalizovane preporuke.', es: 'Aún no hay perspectivas. Agrega más gastos para obtener recomendaciones personalizadas.' }
  };

  // ── Detect current language ──
  function getCurrentLang() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var lang = parsed && parsed.preferences && parsed.preferences.language;
        if (lang && localeMap[lang]) return lang;
      }
    } catch (e) { /* */ }
    return 'English';
  }

  // ── Language code (en/sr/es) from language name ──
  function langCode(langName) {
    if (langName === 'Serbian') return 'sr';
    if (langName === 'Spanish') return 'es';
    return 'en';
  }

  // ── Translate function ──
  function t(key, replacements) {
    var lang = langCode(getCurrentLang());
    var entry = translations[key];
    if (!entry) return key;
    var text = entry[lang] || entry.en || key;
    if (replacements) {
      if (Array.isArray(replacements)) {
        replacements.forEach(function (val, i) {
          text = text.replace('{' + i + '}', val);
        });
      } else if (typeof replacements === 'object') {
        Object.keys(replacements).forEach(function (k) {
          text = text.replace('{' + k + '}', replacements[k]);
        });
      }
    }
    return text;
  }

  // ── Get locale string for current language ──
  function getLocale() {
    return localeMap[getCurrentLang()] || 'en-US';
  }

  // ── Apply translations to all data-i18n elements ──
  function applyI18n(root) {
    root = root || document;

    // Text content
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val !== key) el.textContent = val;
    });

    // Placeholders
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = t(key);
      if (val !== key) el.placeholder = val;
    });

    // innerHTML (for elements with icons etc)
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var val = t(key);
      if (val !== key) el.innerHTML = val;
    });
  }

  // ── Set language and re-apply ──
  function setLanguage(langName) {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      var settings = raw ? JSON.parse(raw) : {};
      if (!settings.preferences) settings.preferences = {};
      settings.preferences.language = langName;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* */ }
    applyI18n();
    // Dispatch event so page scripts can re-render dynamic content
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: langName } }));
  }

  // ── Translate a category name (falls back to original if no translation) ──
  function tCat(catName) {
    if (!catName) return catName;
    var key = 'cat.' + catName.toLowerCase();
    var result = t(key);
    return result === key ? catName : result;
  }

  // ── Expose globally ──
  window.t = t;
  window.tCat = tCat;
  window.getLocale = getLocale;
  window.applyI18n = applyI18n;
  window.setLanguage = setLanguage;
  window.getCurrentLang = getCurrentLang;

  // ── Auto-apply on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyI18n(); });
  } else {
    applyI18n();
  }
})();
