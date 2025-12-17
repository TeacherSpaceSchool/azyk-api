const AdsAzyk = require('../models/adsAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {deleteFile, urlMain, isNotTestUser, isNotEmpty, defaultLimit, reductionSearchText, saveBase64ToFile} = require('../module/const');
const ItemAzyk = require('../models/itemAzyk');

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
    targetPrice: Int
    paymentMethods: [String]
    
    multiplier: Boolean
    targetType: String
    targetItems: [TargetItem]
    xidNumber: Int
 }
  type TargetItem {
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
    addAds(xid: String, image: Upload!, url: String!, title: String!, organization: ID!, item: ID!, count: Int!, targetPrice: Int!, paymentMethods: [String]!): Ads
    setAds(_id: ID!, xid: String, image: Upload, url: String, title: String, item: ID, count: Int, targetPrice: Int, paymentMethods: [String]): String
    deleteAds(_id: ID!): String
`;

const checkAdss = async(invoice, canceled) => {
    const paymentMethods = ['Наличные', 'Перечисление', 'Консигнация']
    const AdsAzyk = require('../models/adsAzyk');
    const InvoiceAzyk = require('../models/invoiceAzyk');
    const {dayStartDefault} = require('../module/const');
    //Ищется заказ
    invoice = await InvoiceAzyk.findById(invoice)
        .select('_id client createdAt rejectedPrice paymentMethod organization allPrice client')
        .lean()
    const ClientWithoutAdsAzyk = require('../models/clientWithoutAdsAzyk');
    if(!(await ClientWithoutAdsAzyk.findOne({client: invoice.client, organization: invoice.organization}).select('_id').lean())) {
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
            .select('_id createdAt rejectedPrice paymentMethod organization allPrice')
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
            //перебор заказов
            const summaryInvoice = {}
            for(const invoice of invoices) {
                summaryInvoice[invoice.paymentMethod] = (summaryInvoice[invoice.paymentMethod]||0) + invoice.allPrice - invoice.rejectedPrice
            }
            //актуальные акции компании
            let adss = await AdsAzyk.find({
                del: {$ne: 'deleted'},
                organization: invoice.organization
            }).sort('targetPrice').lean()
            //подбор акций
            let selectedAdss = []
            for(const ads of adss) {
                const allowedPaymentMethods = paymentMethods.filter(e => ads.paymentMethods.includes(e))
                let allPrice = 0
                Object.keys(summaryInvoice).forEach(paymentMethod => {
                    if(allowedPaymentMethods.includes(paymentMethod)) allPrice += summaryInvoice[paymentMethod]
                });
                if(allPrice>=ads.targetPrice) {
                    if(ads.xid) selectedAdss = selectedAdss.filter(e => e.xid!==ads.xid)
                    selectedAdss.push(ads)
                }
            }
            //Акции записываются к последнему заказу
            await InvoiceAzyk.updateOne({
                _id: invoices[0]._id
            }, {
                adss: selectedAdss.map(ads => ads._id)
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
    addAds: async(parent, {xid, image, url, title, organization, item, count, targetPrice, paymentMethods}, {user}) => {
        if(['суперорганизация', 'организация', 'admin'].includes(user.role)) {
            image = urlMain + await saveBase64ToFile(image)
            // eslint-disable-next-line no-undef
            let [createdObject, itemData] = await Promise.all([
                AdsAzyk.create({
                    image, url, title, organization: user.organization||organization, item, paymentMethods, targetPrice, xid, count
               }),
                ItemAzyk.findById(item).select('_id name').lean(),
            ]);
            return {...createdObject.toObject(), item: itemData}
       }
   },
    setAds: async(parent, {_id, xid, image, url, title, item, count, targetPrice, paymentMethods}, {user}) => {
        if(['суперорганизация', 'организация', 'admin'].includes(user.role)) {
            let object = await AdsAzyk.findById(_id)
            if(item) object.item = item
            if (image) {
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveBase64ToFile(image),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
           }
            if(xid) object.xid = xid
            if(url) object.url = url
            if(title) object.title = title
            if(paymentMethods) object.paymentMethods = paymentMethods
            if(isNotEmpty(count)) object.count = count
            if(isNotEmpty(targetPrice)) object.targetPrice = targetPrice
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