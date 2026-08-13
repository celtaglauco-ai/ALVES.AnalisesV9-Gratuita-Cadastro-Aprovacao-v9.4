# ALVES.AnalisesV9 Profissional

Aplicação Next.js pronta para Render Free, com PostgreSQL gratuito permanente no Neon, autenticação administrativa no servidor e análise estatística gratuita por IA via OpenRouter.

## Segurança

- Sessão administrativa em cookie `HttpOnly`, assinada por HMAC e com duração de 8 horas.
- Senha armazenada apenas como hash `scrypt` com salt.
- Inclusão, atualização e exclusão de ligas protegidas no servidor.
- Visitantes não recebem a interface administrativa.
- Novos cadastros começam como pendentes e somente entram depois da aprovação do administrador.
- O administrador pode aceitar, recusar, bloquear ou excluir usuários.
- As rotas de ligas e IA exigem uma sessão de usuário aprovada ou de administrador.
- Limite básico de 12 consultas de IA por minuto por IP.

Consulte `INSTRUCOES-RENDER.txt` para publicar.

Esta edição não cria banco no Render: `DATABASE_URL` deve receber a conexão de um projeto Neon Free. O código da IA usa somente `openrouter/free` e nunca seleciona automaticamente um modelo pago.
