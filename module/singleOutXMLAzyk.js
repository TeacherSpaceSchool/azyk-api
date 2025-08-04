const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const SingleOutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');
const SingleOutXMLAdsAzyk = require('../models/singleOutXMLAdsAzyk');
const ClientAzyk = require('../models/clientAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const ReturnedAzyk = require('../models/returnedAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const AdsAzyk = require('../models/adsAzyk');
const {pdDDMMYYYY, checkInt, sendPushToAdmin, isNotEmpty, unawaited} = require('./const');
const { v1: uuidv1 } = require('uuid');
const builder = require('xmlbuilder');
const paymentMethod = {'Наличные': 0, 'Перечисление': 1, 'Консигнация': 5}
const {checkFloat} = require('../module/const');
const ModelsErrorAzyk = require('../models/errorAzyk');
const {parallelBulkWrite} = require('./parallel');

module.exports.setSingleOutXMLReturnedAzyk = async(returned) => {
    try {
        //guid по товарам
        const itemIds = returned.items.map(item => item._id)
        let integrateItems = await Integrate1CAzyk.find({item: {$in: itemIds}}).select('item guid').lean()
        const guidByItem = {}
        for(const integrateItem of integrateItems) guidByItem[integrateItem.item] = integrateItem.guid
        //данные товаров
        const data = []
        for(const item of returned.items) {
            //guid товара
            let guid = guidByItem[item._id]
            if (guid) {
                data.push({
                    guid,
                    qt: item.count,
                    price: item.price,
                    amount: item.allPrice,
                    priotiry: item.priotiry
               })
           }
            else {
                const message = `${returned.number} Отсутствует guidItem ${item._id}`
                unawaited(() => ModelsErrorAzyk.create({err: message, path: 'setSingleOutXMLReturnedAzyk'}))
                unawaited(() =>  sendPushToAdmin({message}))
           }
       }
        //xml возврата
        let outXMLReturnedAzyk = await SingleOutXMLReturnedAzyk.findOne({returned: returned._id}).select('_id').lean()
        //если уже есть
        if (outXMLReturnedAzyk) {
            // eslint-disable-next-line no-undef
            await SingleOutXMLReturnedAzyk.updateOne({_id: outXMLReturnedAzyk._id}, {status: 'update',  data})
            return 1
       }
        //новый
        else {
            //район
            let district = await DistrictAzyk.findOne({organization: returned.organization._id, client: returned.client._id, ...returned.agent?{agent: returned.agent._id}:{}}).select('agent ecspeditor').lean()
            if(!district&&returned.agent)
                district = await DistrictAzyk.findOne({organization: returned.organization._id, agent: returned.agent._id}).select('agent ecspeditor').lean()
            if(!district)
                district = await DistrictAzyk.findOne({organization: returned.organization._id, client: returned.client._id}).select('agent ecspeditor').lean()
            if (district) {
                //интеграции
                // eslint-disable-next-line no-undef
                const [integrateClient, integrateAgent, integrateEcspeditor] = await Promise.all([
                    Integrate1CAzyk.findOne({client: returned.client._id, organization: returned.organization._id}).select('guid').lean(),
                    Integrate1CAzyk.findOne({agent: district.agent, organization: returned.organization._id}).select('guid').lean(),
                    Integrate1CAzyk.findOne({ecspeditor: district.ecspeditor, organization: returned.organization._id}).select('guid').lean()
                ])
                if (integrateClient && integrateAgent && integrateEcspeditor) {
                    //дата доставки
                    let date
                    if (returned.dateDelivery)
                        date = new Date(returned.dateDelivery)
                    else {
                        date = new Date(returned.createdAt)
                        if (date.getHours() >= 3)
                            date.setDate(date.getDate() + 1)
                        if (date.getDay() === 0)
                            date.setDate(date.getDate() + 1)
                   }
                    //создание интеграции
                    // eslint-disable-next-line no-undef
                    await SingleOutXMLReturnedAzyk.create({
                        data,
                        guid: returned.guid ? returned.guid : await uuidv1(),
                        date: date,
                        number: returned.number,
                        inv: returned.inv,
                        client: integrateClient.guid,
                        agent: integrateAgent.guid,
                        forwarder: integrateEcspeditor.guid,
                        returned: returned._id,
                        status: 'create',
                        organization: returned.organization._id,
                   })
                    return 1
               }
                else {
                    const message = `${returned.number}${!integrateClient?' Отсутствует guidClient':''}${!integrateAgent?' Отсутствует guidAgent':''}${!integrateEcspeditor?' Отсутствует guidEcspeditor':''}`
                    unawaited(() => ModelsErrorAzyk.create({err: message, path: 'setSingleOutXMLReturnedAzyk'}))
                    unawaited(() => sendPushToAdmin({message}))
               }
           }
            else {
                const message = `${returned.number} Отсутствует district`
                unawaited(() => ModelsErrorAzyk.create({err: message, path: 'setSingleOutXMLReturnedAzyk'}))
                unawaited(() => sendPushToAdmin({message}))
           }
       }
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'setSingleOutXMLReturnedAzyk'}))
        unawaited(() => sendPushToAdmin({message: 'Ошибка setSingleOutXMLReturnedAzyk'}))
   }
    return 0
}

module.exports.setSingleOutXMLAzyk = async(invoice) => {
    try {
        //guid по товарам
        const itemIds = invoice.orders.map(order => order.item._id)
        let integrateItems = await Integrate1CAzyk.find({item: {$in: itemIds}}).select('item guid').lean()
        const guidByItem = {}
        for(const integrateItem of integrateItems) guidByItem[integrateItem.item] = integrateItem.guid
        //данные товаров
        const data = []
        for(const order of invoice.orders) {
            let guidItem = guidByItem[order.item._id]
            //guid товара
            if (guidItem) {
                //количество минус отказ
                const count = order.count - order.returned
                //цена
                const price = checkFloat(order.allPrice/order.count)
                //собираем позицию
                data.push({
                    guid: guidItem,
                    package: Math.round(count/(order.item.packaging?order.item.packaging:1)),
                    qt: count,
                    price: price,
                    amount: checkFloat(count*price),
                    priotiry: order.item.priotiry
               })
           }
            else {
                const message = `${invoice.number} Отсутствует guidItem ${order.item._id}`
                unawaited(() =>  ModelsErrorAzyk.create({err: message, path: 'setSingleOutXMLAzyk'}))
                unawaited(() =>  sendPushToAdmin({message}))
           }
       }
        //интеграция
        let outXMLAzyk = await SingleOutXMLAzyk.findOne({invoice: invoice._id}).select('_id').lean()
        //есть
        if (outXMLAzyk) {
            // eslint-disable-next-line no-undef
            await SingleOutXMLAzyk.updateOne({_id: outXMLAzyk._id}, {status: 'update',  data})
            return 1
       }
        //нету
        else {
            //район
            let district = await DistrictAzyk.findOne({organization: invoice.organization._id, client: invoice.client._id, ...invoice.agent?{agent: invoice.agent._id}:{}}).select('agent ecspeditor').lean()
            if(!district&&invoice.agent)
                district = await DistrictAzyk.findOne({organization: invoice.organization._id, agent: invoice.agent._id}).select('agent ecspeditor').lean()
            if(!district)
                district = await DistrictAzyk.findOne({organization: invoice.organization._id, client: invoice.client._id}).select('agent ecspeditor').lean()
            if (district) {
                //интеграции
                // eslint-disable-next-line no-undef
                const [integrateClient, integrateAgent, integrateEcspeditor] = await Promise.all([
                    Integrate1CAzyk.findOne({client: invoice.client._id, organization: invoice.organization._id}).select('guid').lean(),
                    Integrate1CAzyk.findOne({agent: district.agent, organization: invoice.organization._id}).select('guid').lean(),
                    Integrate1CAzyk.findOne({ecspeditor: district.ecspeditor, organization: invoice.organization._id}).select('guid').lean()
                ])
                if (integrateClient && integrateAgent && integrateEcspeditor) {
                    //добавляем интеграцию
                    // eslint-disable-next-line no-undef
                    await SingleOutXMLAzyk.create({
                        payment: paymentMethod[invoice.paymentMethod],
                        data,
                        guid: invoice.guid ? invoice.guid : await uuidv1(),
                        date: new Date(invoice.dateDelivery),
                        number: invoice.number,
                        client: integrateClient.guid,
                        agent: integrateAgent.guid,
                        forwarder: integrateEcspeditor.guid,
                        invoice: invoice._id,
                        status: 'create',
                        inv: invoice.inv,
                        organization: invoice.organization._id
                   })
                    return 1
               }
                else {
                    const message = `${invoice.number}${!integrateClient?' Отсутствует guidClient':''}${!integrateAgent?' Отсутствует guidAgent':''}${!integrateEcspeditor?' Отсутствует guidEcspeditor':''}`
                    unawaited(() =>  ModelsErrorAzyk.create({err: message, path: 'setSingleOutXMLAzyk'}))
                    unawaited(() =>  sendPushToAdmin({message}))
               }
           }
            else {
                const message = `${invoice.number} Отсутствует district`
                unawaited(() =>  ModelsErrorAzyk.create({err: message, path: 'setSingleOutXMLAzyk'}))
                unawaited(() =>  sendPushToAdmin({message}))
           }
       }
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'setSingleOutXMLAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка setSingleOutXMLAzyk'}))
   }
    return 0
}

module.exports.setSingleOutXMLAzykLogic = async(invoices, forwarder, track) => {
    try {
        if (isNotEmpty(track) || forwarder) {
            let guidEcspeditor
            if (forwarder)
                guidEcspeditor = await Integrate1CAzyk.findOne({ecspeditor: forwarder}).select('guid').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                SingleOutXMLAzyk.updateMany(
                    {invoice: {$in: invoices}},
                    {status: 'update', ...isNotEmpty(track)?{track}:{}, ...guidEcspeditor?{forwarder: guidEcspeditor.guid}:{}}
                ),
                InvoiceAzyk.updateMany(
                    {_id: {$in: invoices}},
                    {sync: 1, ...isNotEmpty(track)?{track}:{}, ...guidEcspeditor?{forwarder}:{}}
                )
            ])
       }
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'setSingleOutXMLAzykLogic'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка setSingleOutXMLAzykLogic'}))
   }
}

module.exports.setSingleOutXMLReturnedAzykLogic = async(returneds, forwarder, track) => {
    try {
        if(isNotEmpty(track)||forwarder) {
            let guidEcspeditor
            if (forwarder)
                guidEcspeditor = await Integrate1CAzyk.findOne({ecspeditor: forwarder}).select('guid').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                SingleOutXMLReturnedAzyk.updateMany(
                    {returned: {$in: returneds}}, {status: 'update', ...isNotEmpty(track)?{track}:{}, ...guidEcspeditor?{forwarder: guidEcspeditor.guid}:{}}
                ),
                ReturnedAzyk.updateMany(
                    {_id: {$in: returneds}}, {sync: 1, ...isNotEmpty(track)?{track}:{}, ...guidEcspeditor?{forwarder}:{}}
                )
            ])
       }
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'setSingleOutXMLReturnedAzykLogic'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка setSingleOutXMLReturnedAzykLogic'}))
   }
}

module.exports.cancelSingleOutXMLReturnedAzyk = async(returned) => {
    try {
        // eslint-disable-next-line no-undef
        await SingleOutXMLReturnedAzyk.updateOne({returned: returned._id}, {status: 'del'})
        return 1
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'cancelSingleOutXMLReturnedAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка cancelSingleOutXMLReturnedAzyk'}))
   }
    return 0
}

module.exports.cancelSingleOutXMLAzyk = async(invoice) => {
    try {
        // eslint-disable-next-line no-undef
        await SingleOutXMLAzyk.updateOne({invoice: invoice._id}, {status: 'del'})
        return 0
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'cancelSingleOutXMLAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка cancelSingleOutXMLAzyk'}))
   }
}

module.exports.getSingleOutXMLAzyk = async(organization) => {
    try {
        //xml
        let result = builder.create('root').att('mode', 'sales');
        //дата
        let date = new Date()
        if(date.getHours()>=3)
            date.setDate(date.getDate() + 1)
        date.setHours(3, 0, 0, 0)
        //интеграции
        let outXMLs = await SingleOutXMLAzyk.find({
            organization: organization._id,
            ...!organization.dateDelivery?{date: {$lte: date}}:{},
            status: {$nin: ['check', 'error']}
        })
            .populate({path: 'invoice', select: 'info address'})
            .sort('date')
            .lean()
        //перебор
        if(outXMLs.length) {
            for(let i = 0; i < outXMLs.length; i++) {
                //добавление в выдачу
                let item = result.ele('item')
                if (outXMLs[i].status === 'del')
                    item.att('del', '1')
                if (outXMLs[i].promo === 1)
                    item.att('promo', '1')
                if (outXMLs[i].inv === 1)
                    item.att('inv', '1')
                if (isNotEmpty(outXMLs[i].payment))
                    item.att('payment', outXMLs[i].payment)
                item.att('guid', outXMLs[i].guid)
                item.att('client', outXMLs[i].client)
                item.att('agent', outXMLs[i].agent)
                item.att('track', outXMLs[i].track ? outXMLs[i].track : 1)
                item.att('forwarder', outXMLs[i].forwarder)
                item.att('date', pdDDMMYYYY(outXMLs[i].date))
                item.att('coment', outXMLs[i].invoice ? `${outXMLs[i].invoice.info} ${outXMLs[i].invoice.address[2] ? `${outXMLs[i].invoice.address[2]}, ` : ''}${outXMLs[i].invoice.address[0]}` : '')
                outXMLs[i].data = outXMLs[i].data.sort((a, b) => checkInt(a.priotiry) - checkInt(b.priotiry));
                for(let ii = 0; ii < outXMLs[i].data.length; ii++) {
                    item.ele('product')
                        .att('guid', outXMLs[i].data[ii].guid)
                        .att('package', outXMLs[i].data[ii].package)
                        .att('qty', outXMLs[i].data[ii].qt)
                        .att('price', outXMLs[i].data[ii].price)
                        .att('amount', outXMLs[i].data[ii].amount)
               }
           }
            result = result.end({pretty: true})
            return result
       }
        else return ''
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'getSingleOutXMLAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка getSingleOutXMLAzyk'}))
   }
}

module.exports.getSingleOutXMLClientAzyk = async (organization) => {
    try {
        //xml
        let result = builder.create('root').att('mode', 'client');
        //интеграция и клиенты из районов
        // eslint-disable-next-line no-undef
        const [integrates, districts] = await Promise.all([
            Integrate1CAzyk.find({$or: [{client: {$ne: null}}, {agent: {$ne: null}}], organization: organization._id}).select('client agent guid').lean(),
            DistrictAzyk.find({organization: organization._id}).select('client agent').lean()
        ]);
        //set интеграций клиентов
        const clientIntegrates = (integrates.filter(integrate => !!integrate.client)).map(integrate => integrate.client.toString())
        //agentByClient
        const agentByClient = {}
        //districtClients
        let districtClients = []
        for(const district of districts) {
            districtClients = [...districtClients, ...district.client]
            for(const client of district.client) {
                agentByClient[client] = district.agent
           }
       }
        //выбираются только интегрированные клиенты из районов
        const integrateDistrictClients = districtClients.filter(districtClient => clientIntegrates.includes(districtClient.toString()))
        //guidByClient
        const guidByClient = {}, guidByAgent = {};
        for(const integrate of integrates) {
            guidByClient[integrate.client||integrate.agent] = integrate.guid
       }
        //клиенты
        const clients = await ClientAzyk.find({
            _id: {$in: integrateDistrictClients},
            sync: {$ne: organization._id.toString()},
            del: {$ne: 'deleted'}
        }).select('_id address name phone').lean();
        //нету клиенты
        if (!clients.length) return '';
        //перебор клиентов
        for(const client of clients) {
            //clientGuid
            const clientGuid = guidByClient[client._id];
            if (!clientGuid) continue;
            //agentId
            const agentId = agentByClient[client._id];
            //agentGuid
            const agentGuid = agentId?guidByAgent[agentId]:null;
            //добавляем в выдачу
            let item = result.ele('item');
            item.att('guid', clientGuid);
            item.att('name', client.address[0][2] || '');
            item.att('contact', client.name || '');
            item.att('address', client.address[0][0]||'');
            item.att('tel', Array.isArray(client.phone) ? client.phone.join(', ') : (client.phone || ''));
            if (agentGuid) item.att('agent', agentGuid);
       }
        //выдача
        return result.end({pretty: true});
   }
    catch (err) {
        unawaited(() =>  ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'getSingleOutXMLClientAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка getSingleOutXMLClientAzyk'}))
        return '';
   }
};

module.exports.getSingleOutXMLReturnedAzyk = async(organization) => {
    try {
        //выдача
        let result = builder.create('root').att('mode', 'returned');
        //возвраты
        let outXMLReturneds = await SingleOutXMLReturnedAzyk
            .find({organization: organization._id, status: {$nin: ['check', 'error']}})
            .populate({path: 'returned'})
            .sort('date')
            .lean()
        //перебор возвратов
        if(outXMLReturneds.length) {
            for(let i=0;i<outXMLReturneds.length;i++) {
                let item = result.ele('item')
                if(outXMLReturneds[i].status==='del')
                    item.att('del', '1')
                if (outXMLReturneds[i].inv === 1)
                    item.att('inv', '1')
                item.att('guid', outXMLReturneds[i].guid)
                item.att('client', outXMLReturneds[i].client)
                item.att('agent', outXMLReturneds[i].agent)
                item.att('forwarder', outXMLReturneds[i].forwarder)
                item.att('date', pdDDMMYYYY(outXMLReturneds[i].date))
                item.att('track', outXMLReturneds[i].track?outXMLReturneds[i].track:1)
                item.att('coment', `${outXMLReturneds[i].returned.info} ${outXMLReturneds[i].returned.address[2]?`${outXMLReturneds[i].returned.address[2]}, `:''}${outXMLReturneds[i].returned.address[0]}`)

                outXMLReturneds[i].data = outXMLReturneds[i].data.sort(function (a, b) {
                    return checkInt(a.priotiry) - checkInt(b.priotiry)
               });

                for(let ii=0;ii<outXMLReturneds[i].data.length;ii++) {
                    item.ele('product')
                        .att('guid', outXMLReturneds[i].data[ii].guid)
                        .att('qty',  outXMLReturneds[i].data[ii].qt)
                        .att('price', outXMLReturneds[i].data[ii].price)
                        .att('amount', outXMLReturneds[i].data[ii].amount)
               }
           }
            result = result.end({pretty: true})
            return result
       }
        else return ''
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'getSingleOutXMLReturnedAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка getSingleOutXMLReturnedAzyk'}))
   }
}

module.exports.reductionOutAdsXMLAzyk = async(organization) => {
    try {
        //дата
        let dateXml = new Date()
        dateXml.setHours(3, 0, 0, 0)
        //интеграции районы интеграции районов
        // eslint-disable-next-line no-undef
        const [integrates, districts, outXMLAdss, adss, adsOrders] = await Promise.all([
            Integrate1CAzyk.find({
                $or: [{agent: {$ne: null}}, {ecspeditor: {$ne: null}}, {item: {$ne: null}}], organization
           }).select('guid agent item ecspeditor').populate('item').lean(),
            DistrictAzyk.find({organization}).select('_id agent ecspeditor client name').lean(),
            SingleOutXMLAdsAzyk.find({organization}).select('district guid').lean(),
            AdsAzyk.find({del: {$ne: 'deleted'}, organization}).lean(),
            InvoiceAzyk.find({
                dateDelivery: dateXml, del: {$ne: 'deleted'}, taken: true, organization, adss: {$ne: []}
           }).select('client adss').lean()
        ]);
        //districtByClient
        const districtByClient = {}
        for(const district of districts) {
            for(const client of district.client) {
                districtByClient[client] = district._id
           }
       }
        //ordersByDistrict
        const ordersByDistrict = {}
        for(const adsOrder of adsOrders) {
            const district = districtByClient[adsOrder.client]
            if(!ordersByDistrict[district]) ordersByDistrict[district] = []
            ordersByDistrict[district].push(adsOrder)
       }
        //adsById
        const adsById = {}
        for(const ads of adss) {
            adsById[ads._id] = ads
       }
        //guidByDistrict
        const guidByDistrict = {}
        for(const outXMLAds of outXMLAdss) {
            guidByDistrict[outXMLAds.district] = outXMLAds.guid
       }
        //guidByAgent guidByEcspeditor
        const guidByAgent = {}, guidByEcspeditor = {}, integrateItemByItem = {}
        for(const integrate of integrates) {
            if(integrate.agent)
                guidByAgent[integrate.agent] = integrate.guid
            else if(integrate.item)
                integrateItemByItem[integrate.item._id] = {...integrate.item, guid: integrate.guid}
            else
                guidByEcspeditor[integrate.ecspeditor] = integrate.guid
       }
        //bulkOperations
        const bulkOperations = [];
        //перебор
        for(const district of districts) {
            const guidDistrict = guidByDistrict[district._id]
            if (guidDistrict) {
                //акционные заказы
                // eslint-disable-next-line no-undef
                const orders = ordersByDistrict[district._id];
                //гуиды
                const guidAgent = guidByAgent[district.agent], guidEcspeditor = guidByEcspeditor[district.ecspeditor]
                if (guidAgent && guidEcspeditor) {
                    if (orders&&orders.length) {
                        let newOutXMLAzyk = {
                            data: [],
                            guid: await uuidv1(),
                            date: dateXml,
                            number: `акции ${district.name}`,
                            client: guidDistrict,
                            agent: guidAgent,
                            forwarder: guidEcspeditor,
                            invoice: null,
                            status: 'create',
                            promo: 1,
                            organization
                       };
                        // 4. Теперь создаем itemsData без асинхронных вызовов
                        const itemsDataMap = {};
                        for(const order of orders) {
                            for(const adsId of order.adss) {
                                const ads = adsById[adsId];
                                const integrateItem = integrateItemByItem[ads.item];
                                if (integrateItem) {
                                    if (!itemsDataMap[integrateItem.guid]) {
                                        itemsDataMap[integrateItem.guid] = {
                                            guid: integrateItem.guid,
                                            qt: 0,
                                            price: integrateItem.price,
                                            package: integrateItem.packaging || 1,
                                            priotiry: integrateItem.priotiry
                                       };
                                   }
                                    itemsDataMap[integrateItem.guid].qt += ads.count;
                               }
                           }
                       }
                        newOutXMLAzyk.data = Object.values(itemsDataMap).map(itemData => ({
                            guid: itemData.guid,
                            package: Math.round(itemData.qt / itemData.package),
                            qt: itemData.qt,
                            price: itemData.price,
                            priotiry: itemData.priotiry,
                            amount: checkFloat(itemData.qt * itemData.price)
                       }))
                        //добавление акционной выгрузки
                        bulkOperations.push({insertOne: {document: newOutXMLAzyk}});
                   }
               }
           }
       }
        if (bulkOperations.length) await parallelBulkWrite(SingleOutXMLAzyk, bulkOperations);
   }
    catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'reductionOutAdsXMLAzyk'}))
        unawaited(() =>  sendPushToAdmin({message: 'Ошибка reductionOutAdsXMLAzyk'}))
   }
}