import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCsv,mappedBody,importRowId} from '../src/csv-import.ts'
test('CSV brasileiro: BOM, aspas, separadores, acentos e quebra interna',()=>{
 const data=parseCsv('\uFEFFNome;Cidade;Observações\r\n"Café; fictício";Fortaleza;"Linha 1\nLinha ""2"""\r\n')
 assert.equal(data.rows[0][0],'Café; fictício');assert.equal(data.rows[0][2],'Linha 1\nLinha "2"')
 assert.deepEqual(mappedBody(data.rows[0],{name:'0',city:'1',notes:'2'}),{name:'Café; fictício',city:'Fortaleza',notes:'Linha 1\nLinha "2"',profile:{}})
 assert.equal(parseCsv('Nome,Cidade\nExemplo,Fortaleza').rows.length,1)
 assert.throws(()=>parseCsv('Nome;Nome\nA;B'),/únicos/);assert.throws(()=>parseCsv('Nome;Cidade\n"A;B'),/aspas/);assert.throws(()=>parseCsv('Nome;Cidade\nA'),/quantidade/)
})
test('Operação é estável por arquivo, ator, espaço e linha',async()=>{
 const a=await importRowId('w','u','arquivo',1)
 assert.equal(a,await importRowId('w','u','arquivo',1))
 assert.notEqual(a,await importRowId('outro','u','arquivo',1));assert.notEqual(a,await importRowId('w','outro','arquivo',1));assert.notEqual(a,await importRowId('w','u','arquivo',2))
})
