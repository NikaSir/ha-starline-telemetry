"""Verify documentation against central authority; no network or dependencies.

Authority: NikaSir/ha-contract-generated-ui at
000afbcec2ed16e5b9611a7a96d8d845e307e5d9.
This checks documentation parity, not runtime or device acceptance.
"""
import hashlib
import json
from pathlib import Path

EXPECTED = {'standard': '2a15e5c2483f0fa959faff54cd29144ddb8c392e6da4546bd4c5034bf652c2c7', 'navigation_contract': '79923d2de82ef59ab76e37491f75ba7eb7e7c4c23e62d75142744159cae64229'}
VERSIONS = {'version': '2.2', 'navigation_contract_version': '1.2'}

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
