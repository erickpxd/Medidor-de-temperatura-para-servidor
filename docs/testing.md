# Plano de testes

## Preparação

Suba o ambiente e acompanhe o consumidor:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f backend
```

Os alvos do `Makefile` publicam payloads no Mosquitto local. Execute `make normal` antes de cada cenário crítico quando quiser garantir uma nova transição. No Wokwi, clique no DHT22 durante a simulação e altere temperatura/umidade nos controles do componente.

## Casos funcionais

| Teste | Entrada | Resultado esperado |
|---|---|---|
| Normal | 30 °C, 60% | buzzer OFF, flags falsas, sem novo `ALERT_STARTED`, status NORMAL |
| Temperatura | 38 °C, 60% | buzzer ON, reason `TEMPERATURE`, `ALERT_STARTED`, um e-mail |
| Umidade | 30 °C, 75% | buzzer ON, reason `HUMIDITY` |
| Ambos | 40 °C, 80% | buzzer ON, reason `TEMPERATURE_AND_HUMIDITY` |
| Recuperação | após alerta: 30 °C, 60% | buzzer OFF, `ALERT_RESOLVED`, NORMAL, e-mail se habilitado |
| Antispam | manter 40 °C por várias leituras | apenas um `ALERT_STARTED` e um e-mail |
| Novo alerta | NORMAL → ALERT → NORMAL → ALERT | dois `ALERT_STARTED`, separados por `ALERT_RESOLVED` |

Publicação local rápida:

```bash
make normal
make temperature
make recovery
make humidity
make recovery
make both
```

Para o teste antispam, execute `make both` várias vezes sem `make recovery`. Para o teste de novo alerta, use `make normal temperature recovery temperature`.

## Robustez e validação

Uma mensagem malformada deve produzir log `[VALIDATION] Message discarded`, enquanto a próxima mensagem válida continua sendo processada:

```bash
docker compose exec mosquitto mosquitto_pub -h localhost \
  -t iot/monitoring/esp32-01/vitals -m '{not-json'
make normal
```

Teste defesa em profundidade publicando valores críticos com flags falsas. O log deve informar que as flags foram substituídas, o status persistido deve ser `ALERT` e deve surgir `ALERT_STARTED` se o estado anterior era NORMAL:

```bash
docker compose exec mosquitto mosquitto_pub -h localhost \
  -t iot/monitoring/esp32-01/vitals \
  -m '{"deviceId":"esp32-01","temperature":40,"humidity":80,"temperatureAlert":false,"humidityAlert":false,"alert":false}'
```

## Testes automatizados

```bash
cd backend
npm install
npm test
npm run check
```

A suíte cobre parse/validação, limites estritos, cálculo e motivos, NORMAL → ALERT, ALERT → NORMAL, alerta sustentado sem duplicidade, novo alerta após recuperação e restauração do estado persistido.

## Inspeção

- Backend: `docker compose logs backend`
- Estado dos serviços: `docker compose ps`
- Grafana: <http://localhost:3000/d/iot-environmental-monitoring>
- InfluxDB: <http://localhost:8086>
- E-mail: verifique a caixa de `ALERT_EMAIL_TO` e também spam; os logs `[EMAIL]` confirmam envio ou erro.
