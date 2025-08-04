let express = require('express');
let router = express.Router();
const {getSingleOutXMLClientAzyk, getSingleOutXMLAzyk, getSingleOutXMLReturnedAzyk} = require('../module/singleOutXMLAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const ClientAzyk = require('../models/clientAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const LimitItemClientAzyk = require('../models/limitItemClientAzyk');
const ItemAzyk = require('../models/itemAzyk');
const UserAzyk = require('../models/userAzyk');
const randomstring = require('randomstring');
const {checkFloat, checkInt, isNotEmpty, unawaited, sendPushToAdmin, formatErrorDetails} = require('../module/const');
const DistrictAzyk = require('../models/districtAzyk');
const StockAzyk = require('../models/stockAzyk');
const WarehouseAzyk = require('../models/warehouseAzyk');
const SpecialPriceClient = require('../models/specialPriceClientAzyk');
const SpecialPriceCategory = require('../models/specialPriceCategoryAzyk');
const {parallelPromise, parallelBulkWrite} = require('../module/parallel');
const SingleOutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');
const ReturnedAzyk = require('../models/returnedAzyk');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const {addIntegrationLog} = require('../module/integrationLog');
const SubBrandAzyk = require('../models/subBrandAzyk');

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/subBrand', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id cities minimumOrder').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/subBrand', xml: req.body.elements[0].elements}))
            //склады
            const subBrandGuids = []
            for(const element of req.body.elements[0].elements) {
                subBrandGuids.push(element.attributes.guid)
            }
            const subBrands = await SubBrandAzyk.find({organization: organization._id, guid: {$in: subBrandGuids}}).select('_id guid').lean()
            const subBrandByGuid = {}
            for(const subBrand of subBrands) {
                subBrandByGuid[subBrand.guid] = subBrand._id
            }
            // подготовим массив операций
            const bulkOperations = [];
            const subBrandsForDelete = []
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const element of req.body.elements[0].elements) {
                //обработан ли
                if(!processedElements[element.attributes.guid]) {
                    processedElements[element.attributes.guid] = true
                    //получаем склад
                    let subBrand = subBrandByGuid[element.attributes.guid]
                    //если нету создаем
                    if (!subBrand)
                        bulkOperations.push({insertOne: {document: {
                                    organization: organization._id, name: element.attributes.name, guid: element.attributes.guid, image: '/static/add.png',
                                    miniInfo: '', status: 'active', minimumOrder: organization.minimumOrder, priotiry: 0, cities: organization.cities
                                }}});
                    //если есть
                    else {
                        //удаляем
                        if(element.attributes.del === '1')
                            subBrandsForDelete.push(subBrand);
                        //обновляем
                        else
                            bulkOperations.push({updateOne: {filter: {_id: subBrand}, update: {$set: {name: element.attributes.name}}}});
                    }
                }
            }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(SubBrandAzyk, bulkOperations);
            // eslint-disable-next-line no-undef
            if (subBrandsForDelete.length) await Promise.all([
                SubBrandAzyk.deleteMany({_id: {$in: subBrandsForDelete}}),
                ItemAzyk.updateMany({subBrand: {$in: subBrandsForDelete}}, {subBrand: null})
            ])
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/subBrand'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/subBrand'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/item', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id cities').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/item', xml: req.body.elements[0].elements}))
            //получаем интеграции
            // eslint-disable-next-line no-undef
            const [integrates, subBrands] = await Promise.all([
                Integrate1CAzyk.find({
                    organization: organization._id, item: {$ne: null},
                    guid: {$in: req.body.elements[0].elements.map(element => element.attributes.guid)}
                }).select('item guid').lean(),
                SubBrandAzyk.find({
                    organization: organization._id, del: {$ne: 'deleted'},
                    guid: {$in: req.body.elements[0].elements.filter(element => element.attributes.subBrand).map(element => element.attributes.subBrand)}
                }).select('_id guid').lean(),
            ])
            const itemByGuid = {}
            for(const integrate of integrates) {
                itemByGuid[integrate.guid] = integrate.item
            }
            const subBrandByGuid = {}
            for(const subBrand of subBrands) {
                subBrandByGuid[subBrand.guid] = subBrand._id
            }
            // подготовим массив операций
            const itemBulkOperations = [];
            const integrateBulkOperations = [];
            const itemsForCreate = []
            //обработанные элементы
            const processedElements = {}
            //перебор товаров
            for(const element of req.body.elements[0].elements) {
                //обработан ли
                if(!processedElements[element.attributes.guid]) {
                    processedElements[element.attributes.guid] = true
                    //товар
                    let item = itemByGuid[element.attributes.guid]
                    //если нету добавляем
                    if (!item) {
                        itemsForCreate.push({
                            name: element.attributes.name,
                            image: process.env.URL.trim() + '/static/add.png',
                            info: '',
                            price: checkFloat(element.attributes.price),
                            organization: organization._id,
                            hit: false,
                            categorys: ['A', 'B', 'C', 'D', 'Horeca'],
                            packaging: checkInt(element.attributes.package),
                            latest: false,
                            status: 'active',
                            weight: checkFloat(element.attributes.weight),
                            priotiry: checkInt(element.attributes.priority),
                            unit: 'шт',
                            city: organization.cities[0],
                            apiece: element.attributes.apiece == '1',
                            guid: element.attributes.guid,
                            ...element.attributes.subBrand?{subBrand: subBrandByGuid[element.attributes.subBrand]}:{}
                        })
                    }
                    // если есть — подготовим updateOne в bulkWrite
                    else {
                        const updateFields = {
                            ...element.attributes.name ? {name: element.attributes.name} : {},
                            ...element.attributes.subBrand ? {subBrand: subBrandByGuid[element.attributes.subBrand]} : {},
                            ...element.attributes.price ? {price: checkFloat(element.attributes.price)} : {},
                            ...element.attributes.package ? {packaging: checkInt(element.attributes.package)} : {},
                            ...element.attributes.weight ? {weight: checkFloat(element.attributes.weight)} : {},
                            ...isNotEmpty(element.attributes.priority) ? {priotiry: checkInt(element.attributes.priority)} : {},
                            ...element.attributes.apiece ? {apiece: element.attributes.apiece == '1'} : {},
                            ...element.attributes.status ? {status: element.attributes.status == '1' ? 'active' : 'deactive'} : {}
                        }
                        if (Object.keys(updateFields).length)
                            itemBulkOperations.push({updateOne: {filter: {_id: item, organization: organization._id}, update: {$set: updateFields}}});
                    }
                }
            }
            //создание товаров
            await parallelPromise(itemsForCreate, async (itemForCreate) => {
                const item = await ItemAzyk.create(itemForCreate);
                integrateBulkOperations.push({insertOne: {document: {
                            item: item._id, organization: organization._id, guid: itemForCreate.guid
                        }}});
            })
            // если есть обновления — выполним bulkWrite
            if (itemBulkOperations.length) await parallelBulkWrite(ItemAzyk, itemBulkOperations);
            if (integrateBulkOperations.length) await parallelBulkWrite(Integrate1CAzyk, integrateBulkOperations);
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/item'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/item'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/warehouse', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/warehouse', xml: req.body.elements[0].elements}))
            //склады
            const warehouseGuids = []
            for(const element of req.body.elements[0].elements) {
                warehouseGuids.push(element.attributes.guid)
            }
            const warehouses = await WarehouseAzyk.find({organization: organization._id, guid: {$in: warehouseGuids}}).select('_id guid').lean()
            const warehouseByGuid = {}
            for(const warehouse of warehouses) {
                warehouseByGuid[warehouse.guid] = warehouse._id
            }
            // подготовим массив операций
            const bulkOperations = [];
            const warehousesForDelete = []
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const element of req.body.elements[0].elements) {
                //обработан ли
                if(!processedElements[element.attributes.guid]) {
                    processedElements[element.attributes.guid] = true
                    //получаем склад
                    let warehouse = warehouseByGuid[element.attributes.guid]
                    //если нету создаем
                    if (!warehouse)
                        bulkOperations.push({insertOne: {document: {organization: organization._id, name: element.attributes.name, guid: element.attributes.guid}}});
                    //если есть
                    else {
                        //удаляем
                        if(element.attributes.del === '1')
                            warehousesForDelete.push(warehouse);
                        //обновляем
                        else
                            bulkOperations.push({updateOne: {filter: {_id: warehouse}, update: {$set: {name: element.attributes.name}}}});
                    }
                }
            }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(WarehouseAzyk, bulkOperations);
            // eslint-disable-next-line no-undef
            if (warehousesForDelete.length) await Promise.all([
                WarehouseAzyk.deleteMany({_id: {$in: warehousesForDelete}}),
                StockAzyk.deleteMany({warehouse: {$in: warehousesForDelete}}),
                DistrictAzyk.updateMany({warehouse: {$in: warehousesForDelete}}, {warehouse: null})
            ])
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/warehouse'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/warehouse'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/stock', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/stock', xml: req.body.elements[0].elements}))
            //получаем интеграции
            const warehouseGuids = []
            for(const element of req.body.elements[0].elements) {
                warehouseGuids.push(element.attributes.warehouse)
            }
            // eslint-disable-next-line no-undef
            const [integrates, warehouses] = await Promise.all([
                Integrate1CAzyk.find({
                    organization: organization._id, item: {$ne: null},
                    guid: {$in: req.body.elements[0].elements.map(element => element.attributes.guid)}
                }).select('item guid').lean(),
                WarehouseAzyk.find({organization: organization._id, guid: {$in: warehouseGuids}}).select('_id guid').lean()
            ])
            //itemByGuid
            const itemByGuid = {}
            for(const integrate of integrates) {
                itemByGuid[integrate.guid] = integrate.item
            }
            //warehouseByGuid
            const warehouseByGuid = {}
            for(const warehouse of warehouses) {
                warehouseByGuid[warehouse.guid] = warehouse._id
            }
            //stockByKey
            const generateKey = (item, warehouse) => `${item.toString()}${warehouse?warehouse.toString():''}`
            const keys = {}
            for(const element of req.body.elements[0].elements) {
                //получаем склад
                let warehouse
                if (element.attributes.warehouse) warehouse = warehouseByGuid[element.attributes.warehouse]
                const item =  itemByGuid[element.attributes.guid]
                if(item) {
                    const key = generateKey(item, warehouse)
                    keys[key] = {item, warehouse}
                }
            }
            // eslint-disable-next-line no-undef
            const stocks = await Promise.all(Object.values(keys).map(async values => StockAzyk.findOne({
                ...values, organization: organization._id
            }).select('_id item warehouse').lean()))
            const stockByKey = {}
            for(const stock of stocks) {
                if (stock) stockByKey[generateKey(stock.item, stock.warehouse)] = stock._id
            }
            // подготовим массив операций
            const bulkOperations = [];
            //обработанные элементы
            const processedElements = {}
            //перебор товаров
            for(const element of req.body.elements[0].elements) {
                //товар
                let item = itemByGuid[element.attributes.guid]
                //если есть товар
                if (item) {
                    //получаем склад
                    let warehouse
                    if (element.attributes.warehouse) warehouse = warehouseByGuid[element.attributes.warehouse]
                    //key
                    const key = generateKey(item, warehouse)
                    //обработан ли
                    if(!processedElements[key]) {
                        processedElements[key] = true
                        //получаем остаток
                        const stock = stockByKey[key]
                        //количество
                        const count = checkFloat(element.attributes.count)
                        //если нету добавляем
                        if (!stock)
                            bulkOperations.push({insertOne: {document: {item, count, warehouse, organization: organization._id}}});
                        // если есть — подготовим updateOne в bulkWrite
                        else
                            bulkOperations.push({updateOne: {filter: {_id: stock}, update: {$set: {count}}}});
                    }
                }
            }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(StockAzyk, bulkOperations);
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/stock'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/stock'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/client', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id cities').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/client', xml: req.body.elements[0].elements}))
            //получаем интеграции
            const integrates = await Integrate1CAzyk.find({
                organization: organization._id,
                $or: [
                    {$and: [
                            {guid: {$in: req.body.elements[0].elements.map(element => element.attributes.guid)}},
                            {client: {$ne: null}}
                        ]},
                    {$and: [
                            {guid: {$in: req.body.elements[0].elements.map(element => element.attributes.agent)}},
                            {agent: {$ne: null}}
                        ]},
                ]
            }).select('agent client guid').lean()
            const clientByGuid = {}, agentByGuid = {}
            for(const integrate of integrates) {
                if(integrate.client)
                    clientByGuid[integrate.guid] = integrate.client
                else
                    agentByGuid[integrate.guid] = integrate.agent
            }
            //cityOrganizations
            const cityOrganizations = await OrganizationAzyk.find({
                cities: organization.cities[0],
                del: {$ne: 'deleted'}
            }).distinct('_id')
            //approximateClients
            const approximateClients = await parallelPromise(req.body.elements[0].elements, async element => {
                if (!clientByGuid[element.attributes.guid]) {
                    let approximateClient = await ClientAzyk.findOne({
                        del: {$ne: 'deleted'},
                        name: element.attributes.name || 'Новый',
                        /*...element.attributes.inn?{inn: element.attributes.inn}:{},
                        ...element.attributes.tel?{'phone.0': element.attributes.tel}:{},*/
                        city: organization.cities[0],
                        'address.0.0': element.attributes.address || '',
                        'address.0.2': element.attributes.name || '',
                    }).select('_id').lean();
                    if(!approximateClient) {
                        const approximateIntegrate = await Integrate1CAzyk.findOne({
                            guid: element.attributes.guid, client: {$ne: null}, organization: {$in: cityOrganizations}
                        }).select('client').lean()
                        if(approximateIntegrate)
                            approximateClient = {_id: approximateIntegrate.client}
                    }
                    if (approximateClient) return {_id: approximateClient._id, guid: element.attributes.guid};
                }
                return null;
            });
            const approximateClientByGuid = {}
            for(const approximateClient of approximateClients) {
                if(approximateClient) approximateClientByGuid[approximateClient.guid] = approximateClient._id
            }
            // подготовим массив операций
            const clientBulkOperations = [];
            const districtPullBulkOperations = [];
            const districtPushBulkOperations = [];
            const agentRouteBulkOperations = [];
            const integrateBulkOperations = [];
            const clientsForCreate = []
            const districtsForUpdate = []
            //integrateClient
            const integrateClient = ({client, agent, guid}) => {
                //создаем интеграцию
                integrateBulkOperations.push({insertOne: {document: {client, organization: organization._id, guid}}});
                //добавляем клиента в район
                if (agent) districtPushBulkOperations.push({updateOne: {filter: {agent}, update: {$push: {client}}}});
            }
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const element of req.body.elements[0].elements) {
                //обработан ли
                if(!processedElements[element.attributes.guid]) {
                    processedElements[element.attributes.guid] = true
                    //находим агента и клиента
                    let clientId = clientByGuid[element.attributes.guid]
                    const agentId = agentByGuid[element.attributes.agent]
                    //если нету клиента ищем примерный
                    let approximateClient
                    if (!clientId) {
                        approximateClient = approximateClientByGuid[element.attributes.guid]
                    }
                    //новый клиент
                    if (!clientId) {
                        if (!approximateClient)
                            //создаем клиента
                            clientsForCreate.push({
                                name: element.attributes.name||'Новый',
                                phone: element.attributes.tel ? [element.attributes.tel] : [],
                                inn: element.attributes.inn,
                                address: [[element.attributes.address || '', '', element.attributes.name || '']],
                                category: element.attributes.category||'B',
                                guid: element.attributes.guid,
                                agentId
                            })
                        else
                            integrateClient({client: approximateClient, agent: agentId, guid: element.attributes.guid})
                    }
                    //обновляем клиента
                    else {
                        clientBulkOperations.push({updateOne: {filter: {_id: clientId}, update: {$set: {
                                        ...element.attributes.name ? {name: element.attributes.name} : {},
                                        ...element.attributes.inn ? {inn: element.attributes.inn} : {},
                                        ...element.attributes.category ? {category: element.attributes.category} : {},
                                        ...element.attributes.tel ? {phone: [element.attributes.tel]} : {},
                                        ...element.attributes.name ? {'address.0.2': element.attributes.name} : {},
                                        ...element.attributes.address ? {'address.0.0': element.attributes.address} : {}
                                    }}}})
                        //обновляем район
                        if (agentId)
                            districtsForUpdate.push({agent: agentId, client: clientId})
                    }
                }
            }
            //создаем клиентов
            await parallelPromise(clientsForCreate, async (clientForCreate) => {
                const user = await UserAzyk.create({
                    login: randomstring.generate({length: 12, charset: 'numeric'}),
                    role: 'client',
                    status: 'active',
                    password: '12345678',
                });
                const client = await ClientAzyk.create({
                    ...clientForCreate,
                    city: organization.cities[0],
                    notification: false,
                    user: user._id
                });
                integrateClient({client: client._id, agent: clientForCreate.agentId, guid: clientForCreate.guid})
            })
            //обновляем район
            await parallelPromise(districtsForUpdate, async (districtForUpdate) => {
                const district = await DistrictAzyk.findOne(districtForUpdate).select('_id').lean()
                //если клиент не добавлен в район
                if (!district) {
                    //очищаем старый район и маршрут
                    districtPullBulkOperations.push({updateMany: {filter: {client: districtForUpdate.client}, update: {$pull: {client: districtForUpdate.client}}}});
                    for(let i = 0; i < 7; i++) {
                        agentRouteBulkOperations.push({
                            updateMany: {filter: {[`clients.${i}`]: districtForUpdate.client}, update: {$pull: {[`clients.${i}`]: districtForUpdate.client}}}
                        })
                    }
                    //добавляем в новый район
                    districtPushBulkOperations.push({updateOne: {filter: {agent: districtForUpdate.agent}, update: {$push: {client: districtForUpdate.client}}}});
                }
            })
            // если есть обновления — выполним bulkWrite
            if (clientBulkOperations.length) await parallelBulkWrite(ClientAzyk, clientBulkOperations);
            if (districtPullBulkOperations.length) await parallelBulkWrite(DistrictAzyk, districtPullBulkOperations);
            if (districtPushBulkOperations.length) await parallelBulkWrite(DistrictAzyk, districtPushBulkOperations);
            if (agentRouteBulkOperations.length) await parallelBulkWrite(AgentRouteAzyk, agentRouteBulkOperations);
            if (integrateBulkOperations.length) await parallelBulkWrite(Integrate1CAzyk, integrateBulkOperations);
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/client'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/client'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/employment', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/employment', xml: req.body.elements[0].elements}))
            //роль
            let position = req.body.elements[0].attributes.mode==='forwarder'?'экспедитор':'агент'
            //получаем интеграции
            const integrates = await Integrate1CAzyk.find({
                organization: organization._id,
                guid: {$in: req.body.elements[0].elements.map(element => element.attributes.guid)},
                $or: [{agent: {$ne: null}}, {ecspeditor: {$ne: null}}]
            }).select('agent ecspeditor guid').lean()
            const employmentByGuid = {}
            for(const integrate of integrates) {
                employmentByGuid[integrate.guid] = integrate.ecspeditor||integrate.agent
            }
            // подготовим массив операций
            const employmentBulkOperations = [];
            const integrateBulkOperations = [];
            /*const guidsForDelete = []
            const employmentsForDelete = []*/
            const employmentsForCreate = []
            //обработанные элементы
            const processedElements = {}
            //перебор сотрудников
            for(const element of req.body.elements[0].elements) {
                //обработан ли
                if(!processedElements[element.attributes.guid]) {
                    processedElements[element.attributes.guid] = true
                    //сотрудник
                    const employment = employmentByGuid[element.attributes.guid]
                    //есть
                    if (employment) {
                        //удалить
                        /*if (element.attributes.del === '1') {
                            guidsForDelete.push(element.attributes.guid)
                            employmentsForDelete.push(employment)
                       }
                        // если обновить — подготовим updateOne в bulkWrite
                        else*/
                        employmentBulkOperations.push({updateOne: {filter: {_id: employment}, update: {$set: {name: element.attributes.name}}}});
                    }
                    //нету добавляем
                    else {
                        employmentsForCreate.push({
                            name: element.attributes.name,
                            guid: element.attributes.guid
                        })
                    }
                }
            }
            //создаем сотрудника
            await parallelPromise(employmentsForCreate, async (employmentForCreate) => {
                const user = await UserAzyk.create({
                    login: randomstring.generate({length: 12, charset: 'numeric'}),
                    role: position,
                    status: 'active',
                    password: '12345678',
                });
                const employment = await EmploymentAzyk.create({
                    name: employmentForCreate.name,
                    email: '',
                    phone: '',
                    organization: organization._id,
                    user: user._id,
                });
                integrateBulkOperations.push({insertOne: {document: {
                            organization: organization._id, guid: employmentForCreate.guid,
                            ...req.body.elements[0].attributes.mode === 'forwarder' ? {ecspeditor: employment._id} : {agent: employment._id}
                        }}});
            })
            // если есть обновления — выполним bulkWrite
            if (employmentBulkOperations.length) await parallelBulkWrite(EmploymentAzyk, employmentBulkOperations);
            if (integrateBulkOperations.length) await parallelBulkWrite(Integrate1CAzyk, integrateBulkOperations);
            /*if(guidsForDelete.length||employmentsForDelete.length) {
                const usersForDelete = employmentsForDelete?await EmploymentAzyk.find({_id: {$in: employmentsForDelete}}).distinct('user'):[]
                // eslint-disable-next-line no-undef
                await Promise.all([
                    usersForDelete.length ? UserAzyk.updateMany({_id: {$in: usersForDelete}}, {status: 'deactive', login: randomstring.generate({length: 12, charset: 'numeric'})}) : null,
                    guidsForDelete.length ? Integrate1CAzyk.deleteMany({guid: {$in: guidsForDelete}}) : null,
                    employmentsForDelete.length ? EmploymentAzyk.updateMany({_id: {$in: employmentsForDelete}}, {del: 'deleted'}) : null,
                ])
           }*/
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/employment'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/employment'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/specialpriceclient', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/specialpriceclient', xml: req.body.elements[0].elements}))
            //получаем интеграции
            const itemGuids = []
            for(const element of req.body.elements[0].elements) {
                for(const el of element.elements) {
                    itemGuids.push(el.attributes.item)
                }
            }
            //получаем интеграции
            const integrates = await Integrate1CAzyk.find({
                organization: organization._id,
                $or: [
                    {$and: [
                            {guid: {$in: req.body.elements[0].elements.map(element => element.attributes.client)}},
                            {client: {$ne: null}}
                        ]},
                    {$and: [
                            {guid: {$in: itemGuids}},
                            {item: {$ne: null}}
                        ]}
                ]
            }).select('client item guid').lean()
            const clientByGuid = {}, itemByGuid = {}
            for(const integrate of integrates) {
                if(integrate.client)
                    clientByGuid[integrate.guid] = integrate.client
                else
                    itemByGuid[integrate.guid] = integrate.item
            }
            //specialPriceClientByKey
            const generateKey = (client, item) => `${client.toString()}${item.toString()}`
            const keys = {}
            for(const element of req.body.elements[0].elements) {
                const client = clientByGuid[element.attributes.client]
                if (client) {
                    for(const el of element.elements) {
                        let item = itemByGuid[el.attributes.item]
                        if(item) {
                            const key = generateKey(client, item)
                            keys[key] = {client, item}
                        }
                    }
                }
            }
            // eslint-disable-next-line no-undef
            const specialPriceClients = await Promise.all(Object.values(keys).map(async values => SpecialPriceClient.findOne({
                ...values, organization: organization._id
            }).select('_id item client').lean()))
            const specialPriceClientByKey = {}
            for(const specialPriceClient of specialPriceClients) {
                if (specialPriceClient) specialPriceClientByKey[generateKey(specialPriceClient.client, specialPriceClient.item)] = specialPriceClient._id
            }
            // подготовим массив операций
            const bulkOperations = [];
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const element of req.body.elements[0].elements) {
                //клиент
                const client = clientByGuid[element.attributes.client]
                //есть клиент
                if (client) {
                    for(const el of element.elements) {
                        let item = itemByGuid[el.attributes.item]
                        if(item) {
                            const key = generateKey(client, item)
                            if(!processedElements[key]) {
                                processedElements[key] = true
                                let specialPriceClient = specialPriceClientByKey[key]
                                if (specialPriceClient)
                                    bulkOperations.push({updateOne: {
                                            filter: {_id: specialPriceClient},
                                            update: {$set: {price: checkFloat(el.attributes.price)}}
                                        }});
                                else {
                                    bulkOperations.push({insertOne: {document: {
                                                client, item, organization: organization._id, price: checkFloat(el.attributes.price),
                                            }}});
                                }

                            }
                        }
                    }
                }
            }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(SpecialPriceClient, bulkOperations);
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/specialpriceclient'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/specialpriceclient'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/limititemclient', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/limititemclient', xml: req.body.elements[0].elements}))
            //получаем интеграции
            const itemGuids = []
            for(const element of req.body.elements[0].elements) {
                for(const el of element.elements) {
                    itemGuids.push(el.attributes.item)
                }
            }
            //получаем интеграции
            const integrates = await Integrate1CAzyk.find({
                organization: organization._id,
                $or: [
                    {$and: [
                            {guid: {$in: req.body.elements[0].elements.map(element => element.attributes.client)}},
                            {client: {$ne: null}}
                        ]},
                    {$and: [
                            {guid: {$in: itemGuids}},
                            {item: {$ne: null}}
                        ]}
                ]
            }).select('client item guid').lean()
            const clientByGuid = {}, itemByGuid = {}
            for(const integrate of integrates) {
                if(integrate.client)
                    clientByGuid[integrate.guid] = integrate.client
                else
                    itemByGuid[integrate.guid] = integrate.item
            }
            //LimitItemClientByKey
            const generateKey = (client, item) => `${client.toString()}${item.toString()}`
            const keys = {}
            for(const element of req.body.elements[0].elements) {
                const client = clientByGuid[element.attributes.client]
                if (client) {
                    for(const el of element.elements) {
                        let item = itemByGuid[el.attributes.item]
                        if(item) {
                            const key = generateKey(client, item)
                            keys[key] = {client, item}
                        }
                    }
                }
            }
            // eslint-disable-next-line no-undef
            const limitItemClients = await Promise.all(Object.values(keys).map(async values => LimitItemClientAzyk.findOne({
                ...values, organization: organization._id
            }).select('_id item client').lean()))
            const limitItemClientByKey = {}
            for(const limitItemClient of limitItemClients) {
                if (limitItemClient) limitItemClientByKey[generateKey(limitItemClient.client, limitItemClient.item)] = limitItemClient._id
            }
            // подготовим массив операций
            const bulkOperations = [];
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const element of req.body.elements[0].elements) {
                //клиент
                const client = clientByGuid[element.attributes.client]
                //есть клиент
                if (client) {
                    for(const el of element.elements) {
                        let item = itemByGuid[el.attributes.item]
                        if(item) {
                            const key = generateKey(client, item)
                            if(!processedElements[key]) {
                                processedElements[key] = true
                                let limitItemClient = limitItemClientByKey[key]
                                if (limitItemClient)
                                    bulkOperations.push({updateOne: {
                                            filter: {_id: limitItemClient},
                                            update: {$set: {limit: checkInt(el.attributes.price)}}
                                        }});
                                else {
                                    bulkOperations.push({insertOne: {document: {
                                                client, item, organization: organization._id, limit: checkInt(el.attributes.price),
                                            }}});
                                }

                            }
                        }
                    }
                }
            }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(LimitItemClientAzyk, bulkOperations);
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/limititemclient'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/limititemclient'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/specialpricecategory', async (req, res, next) => {
    let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            unawaited(() => addIntegrationLog({organization: organization._id, path: '/:pass/put/specialpricecategory', xml: req.body.elements[0].elements}))
            //получаем интеграции
            const itemGuids = []
            for(const element of req.body.elements[0].elements) {
                for(const el of element.elements) {
                    itemGuids.push(el.attributes.item)
                }
            }
            // eslint-disable-next-line no-undef
            const itemIntegrates = await Integrate1CAzyk.find({
                organization: organization._id, guid: {$in: itemGuids}, item: {$ne: null}
            }).select('item guid').lean()
            //товары
            const itemByGuid = {}
            for(const integrate of itemIntegrates) {
                itemByGuid[integrate.guid] = integrate.item
            }
            //specialPriceCategoryByKey
            const generateKey = (category, item) => `${category}${item.toString()}`
            const keys = {}
            for(const element of req.body.elements[0].elements) {
                const category = element.attributes.category
                if (category) {
                    for(const el of element.elements) {
                        let item = itemByGuid[el.attributes.item]
                        if(item) {
                            const key = generateKey(category, item)
                            keys[key] = {category, item}
                        }
                    }
                }
            }
            // eslint-disable-next-line no-undef
            const specialPriceCategories = await Promise.all(Object.values(keys).map(async values => SpecialPriceCategory.findOne({
                ...values, organization: organization._id
            }).select('_id item category').lean()))
            const specialPriceCategoryByKey = {}
            for(const specialPriceCategory of specialPriceCategories) {
                if (specialPriceCategory) specialPriceCategoryByKey[generateKey(specialPriceCategory.category, specialPriceCategory.item)] = specialPriceCategory._id
            }
            // подготовим массив операций
            const bulkOperations = [];
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const element of req.body.elements[0].elements) {
                //категория
                const category = element.attributes.category
                //есть категория
                if (category) {
                    for(const el of element.elements) {
                        let item = itemByGuid[el.attributes.item]
                        if(item) {
                            const key = generateKey(category, item)
                            if(!processedElements[key]) {
                                processedElements[key] = true
                                let specialPriceCategory = specialPriceCategoryByKey[key]
                                if (specialPriceCategory)
                                    bulkOperations.push({updateOne: {
                                            filter: {_id: specialPriceCategory},
                                            update: {$set: {price: checkFloat(el.attributes.price)}}
                                        }});
                                else {
                                    bulkOperations.push({insertOne: {document: {
                                                category, item, organization: organization._id, price: checkFloat(el.attributes.price),
                                            }}});
                                }

                            }
                        }
                    }
                }
            }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(SpecialPriceCategory, bulkOperations);
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/specialpricecategory'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/specialpricecategory'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.get('/:pass/out/client', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
    try{
        let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
        await res.status(200);
        await res.end(await getSingleOutXMLClientAzyk(organization))
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/client'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/client'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.get('/:pass/out/returned', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
    try{
        let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
        await res.status(200);
        await res.end(await getSingleOutXMLReturnedAzyk(organization))
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/out/returned'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/out/returned'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.get('/:pass/out/sales', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
    try{
        let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id dateDelivery').lean()
        await res.status(200);
        await res.end(await getSingleOutXMLAzyk(organization))
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/out/sales'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/out/sales'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/returned/confirm', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
            const errorGuids = [], checkGuids = []
            for(const element of req.body.elements[0].elements) {
                if(element.attributes.exc) errorGuids.push(element.attributes.guid)
                else checkGuids.push(element.attributes.guid)
            }
            // eslint-disable-next-line no-undef
            const returneds = await SingleOutXMLReturnedAzyk.find({organization: organization._id, guid: {$in: req.body.elements[0].elements.map(element => element.attributes.guid)}}).distinct('returned')
            console.log(req.body.elements[0].elements.map(element => element.attributes.guid))
            console.log(returneds)
            // eslint-disable-next-line no-undef
            await Promise.all([
                SingleOutXMLReturnedAzyk.updateMany({organization: organization._id, guid: {$in: errorGuids}}, {status: 'error', exc: 'Ошибка со стороны 1С'}),
                SingleOutXMLReturnedAzyk.updateMany({organization: organization._id, guid: {$in: checkGuids}}, {status: 'check'}),
                ReturnedAzyk.updateMany({_id: {$in: returneds}}, {sync: 2})
            ])
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/returned/confirm'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/returned/confirm'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/sales/confirm', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            let organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
            const errorGuids = [], checkGuids = []
            for(const element of req.body.elements[0].elements) {
                if(element.attributes.exc) errorGuids.push(element.attributes.guid)
                else checkGuids.push(element.attributes.guid)
            }
            // eslint-disable-next-line no-undef
            const invoices = await SingleOutXMLAzyk.find({organization: organization._id, guid: {$in: req.body.elements[0].elements.map(element => element.attributes.guid)}}).distinct('invoice')
            // eslint-disable-next-line no-undef
            await Promise.all([
                SingleOutXMLAzyk.updateMany({organization: organization._id, guid: {$in: errorGuids}}, {status: 'error', exc: 'Ошибка со стороны 1С'}),
                SingleOutXMLAzyk.updateMany({organization: organization._id, guid: {$in: checkGuids}}, {status: 'check'}),
                InvoiceAzyk.updateMany({_id: {$in: invoices}}, {sync: 2})
            ])
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/sales/confirm'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/sales/confirm'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

// eslint-disable-next-line no-unused-vars
router.post('/:pass/put/client/confirm', async (req, res, next) => {
    res.set('Content-Type', 'application/xml');
    try{
        if(req.body.elements[0].elements&&req.body.elements[0].elements.length) {
            const organization = await OrganizationAzyk.findOne({pass: req.params.pass}).select('_id').lean()
            const guids = req.body.elements[0].elements.map(element => element.attributes.guid)
            let clients = await Integrate1CAzyk.find({guid: {$in: guids}, organization: organization._id, client: {$ne: null}}).distinct('client')
            await ClientAzyk.updateMany({_id: {$in: clients}, sync: {$ne: organization._id.toString()}}, {$push: {sync: organization._id.toString()}})
        }
        await res.status(200);
        await res.end('success')
    } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: '/:pass/put/client/confirm'}))
        unawaited(() => sendPushToAdmin({message: 'Сбой /:pass/put/client/confirm'}))
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

module.exports = router;