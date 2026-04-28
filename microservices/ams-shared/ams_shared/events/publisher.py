import json
import os
import logging
import pika

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
EXCHANGE = "ams.events"


def _get_connection():
    params = pika.URLParameters(RABBITMQ_URL)
    params.heartbeat = 60
    return pika.BlockingConnection(params)


def publish_event(routing_key: str, payload: dict) -> None:
    """
    Publish an event to the AMS fanout/topic exchange.

    routing_key examples:
        student.enrolled
        attendance.marked_absent
        result.approved
        fees.due_reminder
        transfer.approved
    """
    try:
        connection = _get_connection()
        channel = connection.channel()
        channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(payload),
            properties=pika.BasicProperties(
                delivery_mode=2,  # persistent
                content_type="application/json",
            ),
        )
        connection.close()
        logger.info("Published event %s", routing_key)
    except Exception as exc:
        logger.error("Failed to publish event %s: %s", routing_key, exc)
