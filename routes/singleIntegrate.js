let express = require('express');
let router = express.Router();
const {getSingleOutXMLClientAzyk, checkSingleOutXMLClientAzyk, getSingleOutXMLAzyk, checkSingleOutXMLAzyk, getSingleOutXMLReturnedAzyk, checkSingleOutXMLReturnedAzyk} = require('../module/singleOutXMLAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');
const ReceivedDataAzyk = require('../models/receivedDataAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const ClientAzyk = require('../models/clientAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const LimitItemClientAzyk = require('../models/limitItemClientAzyk');
const ItemAzyk = require('../models/itemAzyk');
const SubCategoryAzyk = require('../models/subCategoryAzyk');
const UserAzyk = require('../models/userAzyk');
const randomstring = require('randomstring');
const { checkFloat, checkInt } = require('../module/const');
const DistrictAzyk = require('../models/districtAzyk');
const StockAzyk = require('../models/stockAzyk');
const WarehouseAzyk = require('../models/warehouseAzyk');
const SpecialPriceClient = require('../models/specialPriceClientAzyk');
const SpecialPriceCategory = require('../models/specialPriceCategoryAzyk');
const mongoose = require('mongoose');

router.post('/:pass/put/item', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id cities').lean()
    res.set('Content-Type', 'application/xml');
    let subCategory = (await SubCategoryAzyk.findOne({name: 'Не задано'}).select('_id').lean())._id
    try{
        if(req.body.elements[0].elements) {
            let item, integrate1CAzyk
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                integrate1CAzyk = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.guid
                })
                if(!integrate1CAzyk) {
                    item = new ItemAzyk({
                        name: req.body.elements[0].elements[i].attributes.name,
                        image: process.env.URL.trim()+'/static/add.png',
                        info: '',
                        price: checkFloat(req.body.elements[0].elements[i].attributes.price),
                        reiting: 0,
                        subCategory: subCategory,
                        organization: organization._id,
                        hit: false,
                        categorys: ['A','B','C','D','Horeca'],
                        packaging: checkInt(req.body.elements[0].elements[i].attributes.package),
                        latest: false,
                        status: 'active',
                        weight: checkFloat(req.body.elements[0].elements[i].attributes.weight),
                        size: 0,
                        priotiry: 0,
                        unit: 'шт',
                        city: organization.cities[0],
                        apiece: req.body.elements[0].elements[i].attributes.apiece=='1',
                        costPrice: 0
                    });
                    item = await ItemAzyk.create(item);
                    integrate1CAzyk = new Integrate1CAzyk({
                        item: item._id,
                        client: null,
                        agent: null,
                        ecspeditor: null,
                        organization: organization._id,
                        guid: req.body.elements[0].elements[i].attributes.guid,
                    });
                    await Integrate1CAzyk.create(integrate1CAzyk)
                }
                else {
                    item = await ItemAzyk.findOne({_id: integrate1CAzyk.item, organization: organization._id})
                    if(req.body.elements[0].elements[i].attributes.name)
                        item.name = req.body.elements[0].elements[i].attributes.name
                    if(req.body.elements[0].elements[i].attributes.price)
                        item.price = checkFloat(req.body.elements[0].elements[i].attributes.price)
                    if(req.body.elements[0].elements[i].attributes.package)
                        item.packaging = checkInt(req.body.elements[0].elements[i].attributes.package)
                    if(req.body.elements[0].elements[i].attributes.weight)
                        item.weight = checkFloat(req.body.elements[0].elements[i].attributes.weight)
                    if(req.body.elements[0].elements[i].attributes.apiece)
                        item.apiece = req.body.elements[0].elements[i].attributes.apiece=='1'
                    if(req.body.elements[0].elements[i].attributes.status)
                        item.status = req.body.elements[0].elements[i].attributes.status=='1'?'active':'deactive'
                    await item.save()
                }
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put item'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/stock', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            let stock, integrate1CAzyk, count
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                integrate1CAzyk = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.guid
                }).select('item').lean()
                if(integrate1CAzyk) {
                    let warehouse
                    if(req.body.elements[0].elements[i].attributes.warehouse) {
                        warehouse = await WarehouseAzyk.findOne({organization, guid: req.body.elements[0].elements[i].attributes.warehouse}).select('_id').lean()
                        if(warehouse) warehouse = warehouse._id
                    }
                    stock = await StockAzyk.findOne({
                        item: integrate1CAzyk.item,
                        warehouse,
                        organization: organization._id
                    })
                    count = checkFloat(req.body.elements[0].elements[i].attributes.count)
                    if (!stock) {
                        stock = new StockAzyk({
                            item: integrate1CAzyk.item,
                            count,
                            warehouse,
                            organization: organization._id
                        });
                        await StockAzyk.create(stock)
                    } else {
                        stock.count = count
                        await stock.save();
                    }
                }
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put stock'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/warehouse', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            let warehouse, integrate1CAzyk
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                warehouse = await WarehouseAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.guid
                })
                if (!warehouse) {
                    warehouse = new WarehouseAzyk({
                        organization: organization._id,
                        name: req.body.elements[0].elements[i].attributes.name,
                        guid: req.body.elements[0].elements[i].attributes.guid
                    });
                    await WarehouseAzyk.create(warehouse)
                }
                else {
                    warehouse.name = req.body.elements[0].elements[i].attributes.name
                    await warehouse.save();
                }
                const districts = []
                for (let i1 = 0; i1 < req.body.elements[0].elements[i].elements.length; i1++) {
                    req.body.elements[0].elements[i].elements[i1].attributes.guid
                    integrate1CAzyk = await Integrate1CAzyk.findOne({
                        organization: organization._id,
                        guid: req.body.elements[0].elements[i].elements[i1].attributes.guid
                    }).select('agent').lean()
                    if(integrate1CAzyk) {
                        const district = await DistrictAzyk.findOne({agent: integrate1CAzyk.agent}).select('_id').lean()
                        if(district) {
                            districts.push(district._id)
                        }
                    }
                }
                if(districts.length) {
                    await DistrictAzyk.updateMany({_id: {$in: districts}}, {warehouse: warehouse._id})
                }
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put warehouse'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/client', async (req, res, next) => {
    let organization = await OrganizationAzyk
        .findOne({pass: req.params.pass}).select('_id autoIntegrate cities').lean()
    res.set('Content-Type', 'application/xml');
    try{
        let agent, district
        let _object
        let integrate1CAzyk
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                //интеграция клиента
                integrate1CAzyk = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.guid
                }).lean()
                //находим агента
                agent = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.agent
                }).select('agent').lean()
                //автоинтеграция
                if(organization.autoIntegrate) {
                    //новый клиент
                    if(!integrate1CAzyk){
                        //создаем клиента
                        let _client = new UserAzyk({
                            login: randomstring.generate({length: 12, charset: 'numeric'}),
                            role: 'client',
                            status: 'active',
                            password: '12345678',
                        });
                        _client = await UserAzyk.create(_client);
                        _client = new ClientAzyk({
                            name: req.body.elements[0].elements[i].attributes.name ? req.body.elements[0].elements[i].attributes.name : 'Новый',
                            phone: req.body.elements[0].elements[i].attributes.tel,
                            city: organization.cities[0],
                            address: [[
                                req.body.elements[0].elements[i].attributes.address ? req.body.elements[0].elements[i].attributes.address : '',
                                '',
                                req.body.elements[0].elements[i].attributes.name ? req.body.elements[0].elements[i].attributes.name : ''
                            ]],
                            user: _client._id,
                            notification: false,
                            ...req.body.elements[0].elements[i].attributes.category? {category: req.body.elements[0].elements[i].attributes.category}:{}
                        });
                        _client = await ClientAzyk.create(_client);
                        //создаем интеграцию
                        let _object = new Integrate1CAzyk({
                            item: null,
                            client: _client._id,
                            agent: null,
                            ecspeditor: null,
                            organization: organization._id,
                            guid: req.body.elements[0].elements[i].attributes.guid,
                        });
                        await Integrate1CAzyk.create(_object)
                        //добавляем клиента в район
                        if(agent) {
                            district = await DistrictAzyk.findOne({
                                agent: agent.agent
                            })
                            if(district) {
                                district.client.push(_client._id)
                                district.markModified('client');
                                await district.save()
                            }
                        }
                    }
                    else {
                        //обновляем клиента
                        let _client = await ClientAzyk.findOne({_id: integrate1CAzyk.client});
                        if(req.body.elements[0].elements[i].attributes.name)
                            _client.name = req.body.elements[0].elements[i].attributes.name
                        if(req.body.elements[0].elements[i].attributes.category)
                            _client.category = req.body.elements[0].elements[i].attributes.category
                        if(req.body.elements[0].elements[i].attributes.tel) {
                            _client.phone = [req.body.elements[0].elements[i].attributes.tel]
                            _client.markModified('phone');
                        }
                        if(req.body.elements[0].elements[i].attributes.address||req.body.elements[0].elements[i].attributes.name) {
                            _client.address = [[
                                req.body.elements[0].elements[i].attributes.address ? req.body.elements[0].elements[i].attributes.address : _client.address[0][0],
                                _client.address[0][1],
                                req.body.elements[0].elements[i].attributes.name ? req.body.elements[0].elements[i].attributes.name : _client.address[0][2]
                            ]]
                            _client.markModified('address');
                        }
                        await _client.save()
                        //обновляем район
                        if(agent) {
                            let newDistrict = await DistrictAzyk.findOne({
                                agent: agent.agent
                            })
                            //если клиент не добавлен в район
                            if (newDistrict && !newDistrict.client.toString().includes(_client._id.toString())) {
                                let oldDistrict = await DistrictAzyk.findOne({
                                    client: _client._id
                                })
                                if (oldDistrict) {
                                    //очищаем старый маршрут агента
                                    let objectAgentRouteAzyk = await AgentRouteAzyk.findOne({district: oldDistrict._id})
                                    if (objectAgentRouteAzyk) {
                                        for (let i = 0; i < 7; i++) {
                                            let index = objectAgentRouteAzyk.clients[i].indexOf(_client._id.toString())
                                            if (index !== -1)
                                                objectAgentRouteAzyk.clients[i].splice(index, 1)
                                        }
                                        objectAgentRouteAzyk.markModified('clients');
                                        await objectAgentRouteAzyk.save()
                                    }
                                    //очищаем старый район
                                    for (let i = 0; i < oldDistrict.client.length; i++) {
                                        if (oldDistrict.client[i].toString() === _client._id.toString()) {
                                            oldDistrict.client.splice(i, 1)
                                            break
                                        }
                                    }
                                    oldDistrict.markModified('client');
                                    await oldDistrict.save()
                                }
                                //добавляем в новый район
                                newDistrict.client.push(_client._id)
                                newDistrict.markModified('client');
                                await newDistrict.save()
                            }
                        }
                    }
                }
                else {
                    _object = new ReceivedDataAzyk({
                        status: integrate1CAzyk ? 'изменить' : 'добавить',
                        organization: organization._id,
                        name: req.body.elements[0].elements[i].attributes.name,
                        guid: req.body.elements[0].elements[i].attributes.guid,
                        addres: req.body.elements[0].elements[i].attributes.address,
                        category: req.body.elements[0].elements[i].attributes.category,
                        agent: agent?agent.agent:null,
                        phone: req.body.elements[0].elements[i].attributes.tel,
                        type: 'клиент'
                    });
                    await ReceivedDataAzyk.create(_object)
                }
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
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            let position = ''
            let _object
            if (req.body.elements[0].attributes.mode === 'forwarder')
                position = 'экспедитор'
            else
                position = 'агент'
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                _object = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.guid
                }).select('_id agent ecspeditor').lean()
                if (_object) {
                    if (req.body.elements[0].elements[i].attributes.del === '1') {
                        await Integrate1CAzyk.deleteOne({_id: _object._id})
                        let employment = await EmploymentAzyk.findOne({$or: [{_id: _object.agent}, {_id: _object.ecspeditor}]}).select('_id user').lean()
                        await EmploymentAzyk.update({_id: employment._id}, {del: 'deleted'})
                        await UserAzyk.update({_id: employment.user}, {status: 'deactive', login: randomstring.generate({length: 12, charset: 'numeric'})})
                    }
                    else {
                        _object = await EmploymentAzyk.findOne({$or: [{_id: _object.agent}, {_id: _object.ecspeditor}]})
                        _object.name = req.body.elements[0].elements[i].attributes.name
                        await _object.save()
                    }
                }
                else {
                    _object = new UserAzyk({
                        login: randomstring.generate({length: 12, charset: 'numeric'}),
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
                        ...req.body.elements[0].attributes.mode === 'forwarder' ? {ecspeditor: _object._id} : {agent: _object._id}
                    });
                    _object = await Integrate1CAzyk.create(_object)
                }
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

router.post('/:pass/put/specialpriceclient', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                let client = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.client
                }).select('_id client').lean()
                if (client) {
                    client = client.client
                    for (let i1 = 0; i1 < req.body.elements[0].elements[i].elements.length; i1++) {
                        let item = await Integrate1CAzyk.findOne({
                            organization: organization._id,
                            guid: req.body.elements[0].elements[i].elements[i1].attributes.item
                        }).select('_id item').lean()
                        if (item) {
                            item = item.item
                            let specialPriceClient = await SpecialPriceClient.findOne({client, item, organization: organization._id})
                            if(specialPriceClient) {
                                specialPriceClient.price = checkFloat(req.body.elements[0].elements[i].elements[i1].attributes.price)
                            }
                            else {
                                specialPriceClient = new SpecialPriceClient({
                                    client, item, organization: organization._id,
                                    price: checkFloat(req.body.elements[0].elements[i].elements[i1].attributes.price),
                                });
                                await SpecialPriceClient.create(specialPriceClient)
                            }
                        }
                    }
                }
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put specialpriceclient'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/limititemclient', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                let client = await Integrate1CAzyk.findOne({
                    organization: organization._id,
                    guid: req.body.elements[0].elements[i].attributes.client
                }).select('_id client').lean()
                if (client) {
                    client = client.client
                    for (let i1 = 0; i1 < req.body.elements[0].elements[i].elements.length; i1++) {
                        let item = await Integrate1CAzyk.findOne({
                            organization: organization._id,
                            guid: req.body.elements[0].elements[i].elements[i1].attributes.item
                        }).select('_id item').lean()
                        if (item) {
                            item = item.item
                            let limitItemClient = await LimitItemClientAzyk.findOne({client, item, organization: organization._id})
                            if(limitItemClient) {
                                limitItemClient.limit = checkInt(req.body.elements[0].elements[i].elements[i1].attributes.limit)
                            }
                            else {
                                limitItemClient = new LimitItemClientAzyk({
                                    client, item, organization: organization._id,
                                    limit: checkFloat(req.body.elements[0].elements[i].elements[i1].attributes.limit),
                                });
                                await LimitItemClientAzyk.create(limitItemClient)
                            }
                        }
                    }
                }
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put limititemclient'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/:pass/put/specialpricecategory', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                let category = req.body.elements[0].elements[i].attributes.category
                for (let i1 = 0; i1 < req.body.elements[0].elements[i].elements.length; i1++) {
                    let item = await Integrate1CAzyk.findOne({
                        organization: organization._id,
                        guid: req.body.elements[0].elements[i].elements[i1].attributes.item
                    }).select('_id item').lean()
                    if (item) {
                        item = item.item
                        let specialPriceClient = await SpecialPriceCategory.findOne({category, item, organization: organization._id})
                        if(specialPriceClient) {
                            specialPriceClient.price = checkFloat(req.body.elements[0].elements[i].elements[i1].attributes.price)
                        }
                        else {
                            specialPriceClient = new SpecialPriceCategory({
                                category, item, organization: organization._id,
                                price: checkFloat(req.body.elements[0].elements[i].elements[i1].attributes.price),
                            });
                            await SpecialPriceCategory.create(specialPriceClient)
                        }
                    }
                }
            }
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'integrate put specialpriceclient'
        });
        await ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.get('/:pass/out/client', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
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
    res.set('Content-Type', 'application/xml');
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
    res.set('Content-Type', 'application/xml');
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
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                await checkSingleOutXMLReturnedAzyk(req.params.pass, req.body.elements[0].elements[i].attributes.guid, req.body.elements[0].elements[i].attributes.exc)
            }
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
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                await checkSingleOutXMLAzyk(req.params.pass, req.body.elements[0].elements[i].attributes.guid, req.body.elements[0].elements[i].attributes.exc)
            }
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
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements) {
            for (let i = 0; i < req.body.elements[0].elements.length; i++) {
                await checkSingleOutXMLClientAzyk(req.params.pass, req.body.elements[0].elements[i].attributes.guid, req.body.elements[0].elements[i].attributes.exc)
            }
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