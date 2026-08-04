.PHONY: up down logs test validate seed simulate normal temperature humidity both recovery

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

seed:
	docker compose exec -T backend npm run seed

simulate:
	docker compose exec -T backend npm run simulate-alert

normal:
	docker compose exec -T backend npm run simulate -- normal

temperature:
	docker compose exec -T backend npm run simulate -- temperature

humidity:
	docker compose exec -T backend npm run simulate -- humidity

both:
	docker compose exec -T backend npm run simulate -- both

recovery: normal
