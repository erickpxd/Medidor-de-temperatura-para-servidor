# Segurança

## Estado fornecido para desenvolvimento

O Mosquitto do Compose escuta em `1883` e permite clientes anônimos para tornar a demonstração local imediata. O firmware também aponta inicialmente para um broker público sem TLS. **MQTT público sem TLS deve ser utilizado somente para demonstração/desenvolvimento.** Mensagens e credenciais nessa modalidade podem ser observadas ou adulteradas.

Os valores da `.env.example` são marcadores de desenvolvimento. Antes de expor qualquer serviço, copie para `.env`, gere senhas e tokens longos, limite as portas publicadas por firewall e não versione o arquivo.

## Produção recomendada

- Expor somente MQTTS em `8883`, com certificado de uma CA confiável ou CA privada distribuída de forma segura.
- No ESP32, trocar `WiFiClient` por `WiFiClientSecure`, instalar a CA com `setCACert`, apontar `MQTT_PORT` para `8883` e preencher usuário/senha por mecanismo de secrets fora do Git.
- No Mosquitto, definir `allow_anonymous false`, `password_file`, `acl_file`, `cafile`, `certfile`, `keyfile` e `tls_version tlsv1.2`. Cada dispositivo deve publicar somente em seu próprio namespace e o backend deve apenas assinar os tópicos necessários.
- Criar token InfluxDB limitado ao bucket `iot_monitoring`; não reutilizar o token administrativo de setup em produção. Rotacionar tokens e credenciais periodicamente.
- Usar uma conta Grafana sem privilégios administrativos para usuários de dashboard, desabilitar cadastro público e colocar HTTPS/reverse proxy à frente da interface.
- Exigir TLS 1.2 ou superior no SMTP. `SMTP_SECURE=true` é apropriado para TLS implícito (normalmente porta 465); STARTTLS usa `SMTP_SECURE=false` (normalmente 587) e o backend define `requireTLS`.
- Nunca versionar `.env`, certificados privados, chaves ou diretórios `secrets/`; todos estão cobertos pelo `.gitignore`.

## Controles implementados

- Variáveis de ambiente separam credenciais do código e logs nunca exibem senha/token.
- O backend limita payloads a 4096 bytes, exige os seis campos, tipos corretos, números finitos, umidade entre 0 e 100 e `deviceId` em formato restrito e coerente com o namespace do tópico.
- Alertas são recalculados no servidor; booleanos e timestamp enviados pelo dispositivo não são confiáveis.
- JSON malformado ou payload inválido é descartado, registrado e não derruba o consumidor.
- MQTT reconecta automaticamente; escritas InfluxDB têm tentativas; falha de e-mail não interrompe ingestão.
- O timestamp oficial nasce no backend, reduzindo impacto de relógio adulterado ou dessincronizado no dispositivo.
- Imagens têm versões fixadas e os serviços executam em rede Docker dedicada com persistência explícita.

## Separação de ambientes

Mantenha configurações distintas para desenvolvimento e produção. Em produção, não publique diretamente InfluxDB, Mosquitto ou Grafana na internet; use rede privada, firewall, VPN ou proxy autenticado. Prefira um secrets manager do orquestrador e execute varredura de imagens e dependências no CI.
