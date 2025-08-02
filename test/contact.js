//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const {resolvers} = require('../graphql/contactAzyk');
const assert = require('assert').strict;

//Наш основной блок
describe('contact test', () => {
    it('get contact', async () => {
        let contact = resolvers.contact();
        console.log(contact)
        //assert.notStrictEqual([contact].length, 1);
   });
});