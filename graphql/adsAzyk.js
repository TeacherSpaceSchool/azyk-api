const AdsAzyk = require('../models/adsAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {saveImage, deleteFile, urlMain, isNotTestUser, isNotEmpty, defaultLimit, reductionSearchText} = require('../module/const');
const ItemAzyk = require('../models/itemAzyk');
const ClientWithoutAdsAzyk = require('../models/clientWithoutAdsAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');

const type = `
  type Ads {
    _id: ID
    image: String
    url: String
    title: String
    xid: String
    createdAt: Date
    del: String
    item: Item
    count: Int
    organization: Organization
    targetItems: [TargetItem]
    targetPrice: Int
    multiplier: Boolean
    targetType: String
    xidNumber: Int
 }
  type TargetItem {
        xids: [ID]
        count: Int
        sum: Boolean
        type: String
        targetPrice: Int
 }
  input TargetItemInput {
        xids: [ID]
        count: Int
        sum: Boolean
        type: String
        targetPrice: Int
 }
`;

const query = `
    adss(search: String!, organization: ID!, skip: Int): [Ads]
    adsOrganizations: [Organization]
`;

const mutation = `
    addAds(xidNumber: Int, xid: String, image: Upload!, url: String!, title: String!, organization: ID!, item: ID, count: Int, targetItems: [TargetItemInput], targetPrice: Int, multiplier: Boolean, targetType: String): Ads
    setAds(xidNumber: Int, xid: String, _id: ID!, image: Upload, url: String, title: String, item: ID, count: Int, targetItems: [TargetItemInput], targetPrice: Int, multiplier: Boolean, targetType: String): String
    deleteAds(_id: ID!): String
`;

const checkAdss = async(invoice, canceled) => {
    const AdsAzyk = require('../models/adsAzyk');
    const InvoiceAzyk = require('../models/invoiceAzyk');
    const {dayStartDefault} = require('../module/const');
    //Ищется заказ
    invoice = await InvoiceAzyk.findById(invoice)
        .select('_id client createdAt rejectedPrice organization allPrice orders client')
        .populate({
            path: 'orders',
            select: 'count rejected item allPrice'
        })
        .lean()
    const ClientWithoutAdsAzyk = require('../models/clientWithoutAdsAzyk');
    if(!(await ClientWithoutAdsAzyk.findOne({client: invoice.client}).select('_id').lean())) {
        //Рассчитывается дата
        const dateStart = new Date(invoice.createdAt)
        if (dateStart.getHours() < dayStartDefault)
            dateStart.setDate(dateStart.getDate() - 1)
        dateStart.setHours(dayStartDefault, 0, 0, 0)
        const dateEnd = new Date(dateStart)
        dateEnd.setDate(dateEnd.getDate() + 1)
        //Удаляются все акции у заказов
        await InvoiceAzyk.updateMany({
            createdAt: {$gte: dateStart, $lt: dateEnd},
            organization: invoice.organization,
            client: invoice.client
        }, {
            adss: []
        })
        //Ищутся все принятые заказы за этот день кроме заказа с сортировкой по дате
        let invoices = await InvoiceAzyk.find({
            organization: invoice.organization,
            createdAt: {$gte: dateStart, $lt: dateEnd},
            _id: {$ne: invoice._id},
            taken: true,
            client: invoice.client
        })
            .select('_id createdAt rejectedPrice organization allPrice orders')
            .populate({
                path: 'orders',
                select: 'count rejected item allPrice'
            })
            .sort('-createdAt')
            .lean()
        //Если не отменен
        if (!canceled) {
            //Заказ добавляется к заказам
            invoices = [...invoices, invoice]
            //Сортировка по дате
            invoices = invoices.sort((a, b) => b.createdAt - a.createdAt)
        }
        //Если есть заказы
        if (invoices.length) {
            //Переменные
            let resAdss = []
            let idAds = {}
            //актуальные акции компании
            let adss = await AdsAzyk.find({
                del: {$ne: 'deleted'},
                organization: invoice.organization
            })
                .sort('-createdAt')
                .lean()
            //Создается большой заказ
            invoice = {
                rejectedPrice: 0,
                allPrice: 0,
                orders: []
            }
            //Перебираются invoices
            for (let i = 0; i < invoices.length; i++) {
                //Суммируются общая сумма
                invoice.rejectedPrice += invoices[i].rejectedPrice
                invoice.allPrice += invoices[i].allPrice
                //Перебираются orders в invoices
                for (let i1 = 0; i1 < invoices[i].orders.length; i1++) {
                    let found = false
                    //Перебираются orders в большом заказе
                    for (let i2 = 0; i2 < invoice.orders.length; i2++) {
                        //Если найден
                        if (invoices[i].orders[i1].item.toString() === invoice.orders[i2].item.toString()) {
                            //Плюсуются
                            found = true
                            invoice.orders[i2].count += invoices[i].orders[i1].count
                            invoice.orders[i2].rejected += invoices[i].orders[i1].rejected
                            invoice.orders[i2].allPrice += invoices[i].orders[i1].allPrice
                        }
                    }
                    //Если не найден
                    if (!found) {
                        //order добавляется к invoice
                        invoice.orders = [...invoice.orders, invoices[i].orders[i1]]
                    }
                }
            }
            //Подбираются акции
            for (let i = 0; i < adss.length; i++) {
                // Если тип цели — "Цена" и задана целевая цена больше 0
                if (adss[i].targetType === 'Цена' && adss[i].targetPrice && adss[i].targetPrice > 0) {
                    // Проверяем, что итоговая сумма по счету минус возвраты >= целевой цене
                    if ((invoice.allPrice - invoice.rejectedPrice) >= adss[i].targetPrice) {
                        // Проверяем, есть ли у текущего adss[i] xid и удовлетворяет ли условию "новее" (по xidNumber)
                        if (
                            !(adss[i].xid && adss[i].xid.length) // если xid нет,
                            || !idAds[adss[i].xid]                   // или в idAds нет записи с таким xid,
                            || idAds[adss[i].xid].xidNumber < adss[i].xidNumber // или текущий xidNumber больше сохранённого,
                        ) {
                            // Если xid есть и он уже в idAds — удаляем старую запись из результата по индексу
                            if (adss[i].xid && adss[i].xid.length) {
                                if (idAds[adss[i].xid])
                                    // удаляем старый элемент по индексу
                                    resAdss.splice(idAds[adss[i].xid].index, 1)
                                // Обновляем idAds с новым xidNumber и индексом нового элемента (будет добавлен в resAdss)
                                idAds[adss[i].xid] = {xidNumber: adss[i].xidNumber, index: resAdss.length}
                            }
                            // Добавляем _id текущего adss в результирующий массив
                            resAdss.push(adss[i]._id)
                        }
                    }
                }
                // Если тип цели — "Товар" и задан список targetItems (целевых товаров)
                else if (adss[i].targetType === 'Товар' && adss[i].targetItems && adss[i].targetItems.length) {
                    // флаг для проверки, подходят ли все targetItems
                    let check = true
                    // массив для хранения результата проверки по каждому targetItem
                    let checkItemsCount = []
                    // перебор целевых товаров
                    for (let i1 = 0; i1 < adss[i].targetItems.length; i1++) {
                        // Если у targetItem есть параметр sum (некоторая сумма для сравнения)
                        if (adss[i].targetItems[i1].sum) {
                            checkItemsCount[i1] = 0
                            // Итерируемся по всем заказам invoice
                            for (let i2 = 0; i2 < invoice.orders.length; i2++) {
                                // Если xids targetItem содержит item из заказа
                                if (adss[i].targetItems[i1].xids.toString().includes(invoice.orders[i2].item.toString())) {
                                    // Если тип сравнения — "Количество"
                                    checkItemsCount[i1] += adss[i].targetItems[i1].type === 'Количество' ?
                                        invoice.orders[i2].count - invoice.orders[i2].rejected
                                        :
                                        // Иначе суммируем стоимость заказанных с учётом возвратов
                                        (invoice.orders[i2].allPrice / invoice.orders[i2].count * (invoice.orders[i2].count - invoice.orders[i2].rejected))
                                }
                            }
                            // Проверяем, что сумма или количество достигли/превысили целевой уровень
                            checkItemsCount[i1] = checkItemsCount[i1] >= (adss[i].targetItems[i1].type === 'Количество' ? adss[i].targetItems[i1].count : adss[i].targetItems[i1].targetPrice);
                        }
                        // Если sum не задан (или false), проверяем есть ли хотя бы один заказ, удовлетворяющий условию
                        else {
                            checkItemsCount[i1] = false
                            for (let i2 = 0; i2 < invoice.orders.length; i2++) {
                                // Если тип "Количество" — проверяем, что количество (с учетом возврата) >= нужного
                                if (adss[i].targetItems[i1].type === 'Количество')
                                    checkItemsCount[i1] = (adss[i].targetItems[i1].xids.toString().includes(invoice.orders[i2].item.toString()) && (invoice.orders[i2].count - invoice.orders[i2].rejected) >= adss[i].targetItems[i1].count)
                                // Иначе проверяем, что стоимость заказа (с учетом возврата) >= целевой цене
                                else {
                                    checkItemsCount[i1] = (
                                        adss[i].targetItems[i1].xids.toString().includes(invoice.orders[i2].item.toString())
                                        &&
                                        (invoice.orders[i2].allPrice / invoice.orders[i2].count * (invoice.orders[i2].count - invoice.orders[i2].rejected)) >= adss[i].targetItems[i1].targetPrice
                                    )
                                }
                            }
                        }
                    }
                    // Проверяем, что все targetItems прошли проверки
                    if (checkItemsCount.length) {
                        for (let i1 = 0; i1 < checkItemsCount.length; i1++) {
                            // Если хоть один не прошел — сбрасываем флаг
                            if (!checkItemsCount[i1])
                                check = false
                        }
                    }
                    // Если целевых товаров нет, считаем что проверка не пройдена
                    else
                        check = false
                    // Если все условия пройдены и xid у текущего adss либо нет, либо он "новее" записанного
                    if (check &&
                        (
                            !(adss[i].xid && adss[i].xid.length)
                            ||
                            !idAds[adss[i].xid]
                            ||
                            idAds[adss[i].xid].xidNumber < adss[i].xidNumber
                        )) {
                        if (adss[i].xid && adss[i].xid.length) {
                            // Если xid уже есть в idAds — удаляем старую запись из результата
                            if (idAds[adss[i].xid])
                                resAdss.splice(idAds[adss[i].xid].index, 1)
                            // Записываем текущий xid с новым индексом и номером
                            idAds[adss[i].xid] = {xidNumber: adss[i].xidNumber, index: resAdss.length}
                        }
                        // Добавляем _id текущего adss в результат
                        resAdss.push(adss[i]._id)
                    }
                }
            }
            //Акции записываются к последнему заказу
            await InvoiceAzyk.updateOne({
                _id: invoices[0]._id
            }, {
                adss: resAdss
            })
        }
    }
}

const resolvers = {
    adss: async(parent, {search, organization, skip}, {user}) => {
        if(user.role) {
            const subbrand = await SubBrandAzyk.findById(organization).select('organization').lean()
            if(subbrand)
                organization = subbrand.organization
            organization = user.organization||organization
            return await AdsAzyk.find({
                del: {$ne: 'deleted'},
                ...search?{title: {$regex: reductionSearchText(search), $options: 'i'}}:{},
                organization
           })
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .populate({
                    path: 'item',
                    select: 'name _id'
               })
                .sort('-createdAt')
                .lean()
       }
   },
    adsOrganizations: async(parent, ctx, {user}) => {
        if(user.role) {
            if (user.organization) {
                return await OrganizationAzyk
                    .find({_id: user.organization})
                    .select('image name miniInfo _id')
                    .lean()
           }
            else {
                let organizations = await AdsAzyk.find({del: {$ne: 'deleted'}}).distinct('organization')
                organizations = await OrganizationAzyk.find({
                    _id: {$in: organizations},
                    ...isNotTestUser(user)?{status: 'active'}:{},
                    ...user.city ? {cities: user.city} : {},
                    del: {$ne: 'deleted'}
               })
                    .select('image name miniInfo _id')
                    .sort('name')
                    .lean()
                return organizations
           }
       }
   }
};

const resolversMutation = {
    addAds: async(parent, {xidNumber, xid, image, url, title, organization, item, count, targetItems, targetPrice, multiplier, targetType}, {user}) => {
        if(['суперорганизация', 'организация', 'admin'].includes(user.role)) {
            let {stream, filename} = await image;
            image = urlMain + await saveImage(stream, filename)
            // eslint-disable-next-line no-undef
            let [createdObject, itemData] = await Promise.all([
                AdsAzyk.create({
                    image, url, title, organization: user.organization||organization, item, targetItems, targetPrice,
                    multiplier, xid, targetType, xidNumber, count
               }),
                ItemAzyk.findById(item).select('_id name').lean(),
            ]);


            return {...createdObject.toObject(), item: itemData}
       }
   },
    setAds: async(parent, {xidNumber, xid, _id, image, url, title, item, count, targetItems, targetPrice, multiplier, targetType}, {user}) => {
        if(['суперорганизация', 'организация', 'admin'].includes(user.role)) {
            let object = await AdsAzyk.findById(_id)
            object.item = item
            if (image) {
                let {stream, filename} = await image;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
           }
            if(xid) object.xid = xid
            if(url) object.url = url
            if(title) object.title = title
            if(isNotEmpty(xidNumber)) object.xidNumber = xidNumber
            if(isNotEmpty(count)) object.count = count
            object.targetItems = targetItems
            if(isNotEmpty(targetPrice)) object.targetPrice = targetPrice
            if(isNotEmpty(multiplier)) object.multiplier = multiplier
            if(targetType) object.targetType = targetType
            await object.save();
            return 'OK'
        }
   },
    deleteAds: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'admin'].includes(user.role)) {
            let adsImage = await AdsAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}}).select('image').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                deleteFile(adsImage.image),
                AdsAzyk.updateOne({_id}, {del: 'deleted'})
            ])
            return 'OK'
        }
   }
};

module.exports.checkAdss = checkAdss;
module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;