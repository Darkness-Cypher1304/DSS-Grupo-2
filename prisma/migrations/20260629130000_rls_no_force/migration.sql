-- ============================================================================
-- NeuroAlert · RLS: quitar FORCE (habilitar deploy con usuario de BD no-superuser)
-- ============================================================================
-- Contexto: en Render el backend se conecta con un usuario que es DUEÑO de las
-- tablas pero NO superusuario. Con FORCE ROW LEVEL SECURITY, incluso el dueño
-- queda sujeto a las políticas RLS, y como la app aún NO setea el contexto de
-- sesión en TODAS las queries (eso es "Fase 2"), el login fallaba al insertar el
-- refresh token (P0001/RLS).
--
-- Se quita FORCE: RLS sigue ENABLED y las políticas siguen vigentes para roles
-- NO-dueños (defensa en profundidad real frente a conexiones de terceros). El
-- rol dueño (la app) opera normalmente. En local el usuario es superuser → ya
-- bypaseaba RLS, así que no cambia. La aplicación FORCE + contexto-por-query
-- queda para Fase 2.
-- ============================================================================
ALTER TABLE mchat_screenings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE questions        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE answers          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE contents         NO FORCE ROW LEVEL SECURITY;
