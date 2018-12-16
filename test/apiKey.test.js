(() => {
    'use strict';

    const chai = require('chai');
    const chaiHttp = require('chai-http');
    const expect = chai.expect;

    chai.use(chaiHttp);

    describe('Test main.js', () => {

        describe('Test API key request', () => {

            it('Should return an API key', async () => {
                const apiKey = await require('../apiKey.js').getAPIKey(false);
                expect(apiKey).to.be.a('string');
                expect(apiKey).to.have.lengthOf.above(0);
            }).timeout(10000);

        });
    });
})();