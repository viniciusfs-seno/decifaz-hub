import {test} from 'node:test'
import assert from 'node:assert/strict'
import {brazilianPhone,internationalPhone} from '../src/brazilian-contact.ts'
test('Telefone brasileiro respeita DDD, tipo e texto internacional/legado',()=>{assert.equal(brazilianPhone('(11) 99999-0000').e164,'+5511999990000');assert.equal(brazilianPhone('85 3333 0000').formatted,'(85) 3333-0000');assert.equal(brazilianPhone('99999-0000'),null);assert.equal(brazilianPhone('00 99999-0000'),null);assert.equal(brazilianPhone('+44 20 7946 0000'),null);assert.equal(internationalPhone('+44 20 7946 0000'),'+442079460000');assert.equal(internationalPhone('telefone legado'),null)})
