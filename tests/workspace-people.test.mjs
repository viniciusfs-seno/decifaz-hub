import test from 'node:test'
import assert from 'node:assert/strict'
import {memberOwner} from '../src/workspace-people.ts'
test('Identificação usa vínculo explícito, preserva texto histórico e não infere por nome',()=>{
 const person={id:'12345678-0000-4000-8000-000000000001',name:'Conta comercial-ficticia',active:true}
 assert.equal(memberOwner('Integrante 12345678',[person]),person.name)
 assert.equal(memberOwner('Nome antigo',[person]),'Nome antigo')
 assert.equal(memberOwner('Nome antigo',[person],person.id),person.name)
 assert.equal(memberOwner('Integrante 12345678',[person,{...person,id:'12345678-0000-4000-8000-000000000002'}]),'Integrante 12345678')
 assert.equal(memberOwner('Nome antigo',[]), 'Nome antigo')
 assert.equal(memberOwner('',[{...person,active:false}],person.id),person.name+' (desativado)')
})
