let express = require('express');
let router = express.Router();
const {getSingleOutXMLClientAzyk, checkSingleOutXMLClientAzyk, getSingleOutXMLAzyk, checkSingleOutXMLAzyk, getSingleOutXMLReturnedAzyk, checkSingleOutXMLReturnedAzyk} = require('../module/singleOutXMLAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');
const ReceivedDataAzyk = require('../models/receivedDataAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const UserAzyk = require('../models/userAzyk');
const randomstring = require('randomstring');

router.post('/:pass/put/client', async (req, res, next) => {
    let startDate = new Date()
    let organization = await OrganizationAzyk
        .findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content+Type', 'application/xml');
    try{
        let agent
        let _object
        let integrate1CAzyk
        for(let i=0;i<req.body.elements[0].elements.length;i++) {
            integrate1CAzyk = await Integrate1CAzyk.findOne({
                organization: organization._id,
                guid: req.body.elements[0].elements[i].attributes.guid
            }).select('_id').lean()
            agent = await Integrate1CAzyk.findOne({
                organization: organization,
                guid: req.body.elements[0].elements[i].attributes.agent
            }).select('agent').lean()
            if(agent&&!integrate1CAzyk) {
                _object = new ReceivedDataAzyk({
                    status: integrate1CAzyk ? 'изменить' : 'добавить',
                    organization: organization._id,
                    name: req.body.elements[0].elements[i].attributes.name,
                    guid: req.body.elements[0].elements[i].attributes.guid,
                    addres: req.body.elements[0].elements[i].attributes.address,
                    agent: agent.agent,
                    phone: req.body.elements[0].elements[i].attributes.tel,
                    type: 'клиент'
                });
                await ReceivedDataAzyk.create(_object)
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put client'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/employment', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content+Type', 'application/xml');
    try{
        let position = ''
        let _object
        if(req.body.elements[0].attributes.mode==='forwarder')
            position = 'экспедитор'
        else
            position = 'агент'
        for(let i=0;i<req.body.elements[0].elements.length;i++) {
            _object = await Integrate1CAzyk.findOne({
                organization: organization._id,
                guid: req.body.elements[0].elements[i].attributes.guid
            }).select('_id agent ecspeditor').lean()
            if(_object){
                if(req.body.elements[0].elements[i].attributes.del==='1') {
                    await Integrate1CAzyk.deleteMany({_id: _object._id})
                    await EmploymentAzyk.deleteMany({$or: [{_id: _object.agent}, {_id: _object.ecspeditor}]})
                }
                else {
                    _object = await EmploymentAzyk.findOne({$or: [{_id: _object.agent}, {_id: _object.ecspeditor}]})
                    _object.name = req.body.elements[0].elements[i].attributes.name
                    await _object.save()
                }
            }
            else {
                _object = new UserAzyk({
                    login: randomstring.generate(20),
                    role: position,
                    status: 'active',
                    password: '12345678',
                });
                _object = await UserAzyk.create(_object);
                _object = new EmploymentAzyk({
                    name: req.body.elements[0].elements[i].attributes.name,
                    email: '',
                    phone: '',
                    organization: organization._id,
                    user: _object._id,
                });
                await EmploymentAzyk.create(_object);
                _object = new Integrate1CAzyk({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.guid,
                    ...req.body.elements[0].attributes.mode==='forwarder'?{ecspeditor: _object._id}:{agent: _object._id}
                });
                _object = await Integrate1CAzyk.create(_object)
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put employment'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.get('/:pass/out/client', async (req, res, next) => {
    res.set('Content+Type', 'application/xml');
    try{
        await res.status(200);
        await res.end(await getSingleOutXMLClientAzyk(req.params.pass))
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate out client'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.get('/:pass/out/returned', async (req, res, next) => {
    res.set('Content+Type', 'application/xml');
    try{
        await res.status(200);
        await res.end(await getSingleOutXMLReturnedAzyk(req.params.pass))
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate out returned'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.get('/:pass/out/sales', async (req, res, next) => {
    res.set('Content+Type', 'application/xml');
    try{
        await res.status(200);
        await res.end(await getSingleOutXMLAzyk(req.params.pass))
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate out sales'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/returned/confirm', async (req, res, next) => {
    res.set('Content+Type', 'application/xml');
    try{
        for(let i=0;i<req.body.elements[0].elements.length;i++) {
            await checkSingleOutXMLReturnedAzyk(req.params.pass, req.body.elements[0].elements[i].attributes.guid, req.body.elements[0].elements[i].attributes.exc)
        }
         await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate returned confirm'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/sales/confirm', async (req, res, next) => {
    res.set('Content+Type', 'application/xml');
    try{
        for(let i=0;i<req.body.elements[0].elements.length;i++) {
            await checkSingleOutXMLAzyk(req.params.pass, req.body.elements[0].elements[i].attributes.guid, req.body.elements[0].elements[i].attributes.exc)
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate sales confirm'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/client/confirm', async (req, res, next) => {
    res.set('Content+Type', 'application/xml');
    try{
        for(let i=0;i<req.body.elements[0].elements.length;i++) {
            await checkSingleOutXMLClientAzyk(req.params.pass, req.body.elements[0].elements[i].attributes.guid, req.body.elements[0].elements[i].attributes.exc)
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate client confirm'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

module.exports = router;