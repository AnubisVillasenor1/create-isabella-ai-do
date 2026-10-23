import sys
import json
from pydantic import ValidationError

from latam_aegis.config import Settings
from latam_aegis.domain import SecurityEvent
from latam_aegis.ml import SafeFallbackDetector
from latam_aegis.wall import AdaptiveWall
from latam_aegis.audit import AuditLedger
from latam_aegis.pipeline import SecurityPipeline

def main():
    try:
        # Leer JSON desde stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"error": "Entrada vacía"}), file=sys.stderr)
            sys.exit(1)
            
        event_dict = json.loads(input_data)
        
        # Validar evento de seguridad
        event = SecurityEvent(**event_dict)
        
        # Cargar configuración y pipeline
        settings = Settings()
        pipeline = SecurityPipeline(
            settings=settings,
            model=SafeFallbackDetector(),
            wall=AdaptiveWall(),
            ledger=AuditLedger(
                settings.audit_secret.get_secret_value()
            ),
        )
        
        # Procesar evento
        result = pipeline.process(event)
        
        # Retornar el resultado como JSON
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError as err:
        print(json.dumps({"error": f"JSON inválido: {str(err)}"}), file=sys.stderr)
        sys.exit(1)
    except ValidationError as err:
        print(json.dumps({"error": f"Validación Pydantic falló: {err.errors()}"}), file=sys.stderr)
        sys.exit(1)
    except Exception as err:
        print(json.dumps({"error": f"Fallo interno en el pipeline Python: {str(err)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
