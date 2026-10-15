// Execução única por solicitação expressa, nunca em builds normais.
if(process.env.ADMIN_BOOTSTRAP_ONCE==="1")await import("./bootstrap-admin.mjs");
