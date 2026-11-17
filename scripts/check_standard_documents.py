"""Verify documentation against central authority; no network or dependencies.

Authority: NikaSir/ha-contract-generated-ui at
f04fdc8904472008878a81dceaca39066f11cf75.
This checks documentation parity, not runtime or device acceptance.
"""
import hashlib
import json
from pathlib import Path

EXPECTED = {
    'standard': '39691a1e8ad5b98a961d518ab7b38761f3b04e7f7eb032dc19e3c68b4f249083',
    'navigation_contract': '26269e700cffa7cc1b0a2f93ff6314ed3d366f988460168c312324511f282423',
    'refresh_contract': 'c778927d0a94aa48c818916f49fc295a60f51d26367c3c85ecb9bf789ee463e2',
    'shell_kit': '398d6ff9eb5b1fb11d771e174ae7b010908c276681b1ca14e9757073ee10bb1c',
}
VERSIONS = {'version': '2.2', 'navigation_contract_version': '1.3'}

def validate(root):
    errors = []
    try:
        declaration = json.loads((root / '.nikas-ui-standard.json').read_text())
        if not isinstance(declaration, dict):
            return ['standard declaration must be an object']
        for key, version in VERSIONS.items():
            if declaration.get(key) != version:
                errors.append(f'{key}: expected {version}')
        for key, expected in EXPECTED.items():
            if declaration.get(key + '_sha256') != expected:
                errors.append(f'{key}: declaration differs from pinned authority')
            path = declaration.get(key + '_path')
            if not isinstance(path, str) or not path:
                errors.append(f'{key}: missing document path')
                continue
            target = (root / path).resolve()
            if not target.is_relative_to(root.resolve()):
                errors.append(f'{key}: document must be inside repository')
                continue
            try:
                actual = hashlib.sha256(target.read_bytes()).hexdigest()
            except OSError as error:
                errors.append(f'{key}: {error}')
                continue
            if actual != expected:
                errors.append(f'{key}: document differs from pinned authority')
    except (OSError, ValueError) as error:
        errors.append(str(error))
    return errors

if __name__ == '__main__':
    errors = validate(Path(__file__).resolve().parents[1])
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Standard documents match pinned central authority (device acceptance unchanged).')
