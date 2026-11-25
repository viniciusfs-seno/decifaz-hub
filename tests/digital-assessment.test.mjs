import {test} from 'node:test'
import assert from 'node:assert/strict'
import {digitalPayload,digitalError,emptyDigitalAssessment} from '../src/digital-assessment.ts'
import {solutions} from '../src/domain.ts'
test('Presença separa payload aplicável do rascunho e não renomeia produtos',()=>{const value={site:{...emptyDigitalAssessment(),presence:'not_found',quality:'poor',evidence:'Pesquisa fictícia'},other:{...emptyDigitalAssessment(),enabled:false,label:'Texto retido'}};const payload=digitalPayload(value);assert.equal(payload.site.quality,null);assert.equal(payload.other,undefined);assert.equal(value.site.quality,'poor');assert.equal(value.other.label,'Texto retido');assert.equal(digitalError({site:{...emptyDigitalAssessment(),presence:'identified',quality:'poor',url:'https://example.invalid'}}).field,'observation');assert.ok(solutions.includes('Cardápio digital'))})

test('Reabrir presença antes não encontrada não inventa uma qualidade',()=>{assert.equal(digitalPayload({site:{...emptyDigitalAssessment(),presence:'identified',quality:null}}).site.quality,'unassessed')})
