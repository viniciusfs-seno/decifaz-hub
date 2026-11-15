import test from 'node:test'
import assert from 'node:assert/strict'
import {can} from '../src/access.ts'
test('matriz frontend nega desconhecidos e separa escrita por módulo',()=>{
 for(const role of ['admin','commercial','operations','finance']){
  assert.equal(can(role,'commercial'),true)
  assert.equal(can(role,'projects'),true)
  assert.equal(can(role,'commercial',true),['admin','commercial'].includes(role))
  assert.equal(can(role,'projects',true),['admin','operations'].includes(role))
  assert.equal(can(role,'finance'),['admin','finance'].includes(role))
 }
 assert.equal(can(undefined,'finance'),false)
})

test('papéis acumulam permissões por módulo',()=>{
 assert.equal(can(['commercial','operations'],'commercial',true),true)
 assert.equal(can(['commercial','operations'],'projects',true),true)
 assert.equal(can(['commercial','operations'],'finance'),false)
 assert.equal(can(['commercial','finance'],'finance',true),true)
 assert.equal(can(['commercial','finance'],'projects',true),false)
 assert.equal(can([],'commercial'),false)
})
