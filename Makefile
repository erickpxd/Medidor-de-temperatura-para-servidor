.PHONY: up down logs test validate normal temperature humidity both recovery

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend

test:
	cd backend && npm test

validate:
	docker compose config --quiet
	cd backend && npm run check && npm test

normal:
	docker compose exec mosquitto mosquitto_pub -h localhost -t iot/monitoring/esp32-01/vitals -m '{"deviceId":"esp32-01","temperature":30,"humidity":60,"temperatureAlert":false,"humidityAlert":false,"alert":false}'

temperature:
	docker compose exec mosquitto mosquitto_pub -h localhost -t iot/monitoring/esp32-01/vitals -m '{"deviceId":"esp32-01","temperature":38,"humidity":60,"temperatureAlert":true,"humidityAlert":false,"alert":true}'

humidity:
	docker compose exec mosquitto mosquitto_pub -h localhost -t iot/monitoring/esp32-01/vitals -m '{"deviceId":"esp32-01","temperature":30,"humidity":75,"temperatureAlert":false,"humidityAlert":true,"alert":true}'

both:
	docker compose exec mosquitto mosquitto_pub -h localhost -t iot/monitoring/esp32-01/vitals -m '{"deviceId":"esp32-01","temperature":40,"humidity":80,"temperatureAlert":true,"humidityAlert":true,"alert":true}'

recovery: normal
