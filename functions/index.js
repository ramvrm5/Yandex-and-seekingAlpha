const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid')
var serviceAccount = require("./permissions.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://autofeed2020.firebaseio.com"
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true })

const axios = require('axios');
const request = require('request');
const cheerio = require("cheerio");
const fs = require("fs");
const json2csv = require("json2csv").Parser;
const htmlToText = require('html-to-text');

const moment = require('moment');

const express = require('express');
const cors = require('cors');
const { endianness } = require('os');
const { url } = require('inspector');
const { urlencoded } = require('body-parser');
const app = express();

app.use(cors({ origin: true }));

let fecha = parseInt(moment(new Date()).format("x") / 1000);
let fechaClasica = new Date().toISOString()
let News_found = "NO"
let Arraydata = [{
    titulo: "",
    descripcion: "",
    cuerpo: "",
    img: "",
    url: "",
    fecha: fecha,
    fechaClasica: fechaClasica,
    fuente: '',
    tags: '',
    idioma: '',
}];
let tags = []

async function getAlltags() {
    try {
        let query = await db.collection('usuarios');
        await query.get()
            .then(async function (querySnapshot) {
                let docs = querySnapshot.docs;
                for (let doc of docs) {
                    if (doc.data().tags) {
                        for (let tag of doc.data().tags) {
                            if(tag){
                                let tempTags = tag.split(";")
                                for (let i = 0; tempTags.length > i; i++) {
                                    tags.push(tempTags[i]);
                                }
                            }
                        }
                    }
                }
                //console.log(tags)
                seekingalpha()
            });
    } catch (error) {
        console.log(error);
    }
}


async function yandexNews() {
    for (let j = 0; tags.length > 0;) {
        console.log("tag :" + tags[j])
        if (tags[j]) {
            let yandexNews_tag = tags[j]
            let url_yandexNews = 'https://newssearch.yandex.ru/yandsearch?text=' + yandexNews_tag + '&rpt=nnews2&rel=rel&within=9';
            axios({
                method: 'get',
                url: url_yandexNews,
            }).then(response => {
                getData(response.data, "yandexNews", yandexNews_tag);

                const batch = db.batch();
                let arraytags = [];
                arraytags.push(yandexNews_tag);

                Arraydata.forEach(function (object, i, array) {
                    let unique_id = db.collection("my_collection").doc().id + "_yandexNews";
                    const Ref = db.collection('noticias').doc('/' + unique_id + '/')
                    batch.set(Ref, {
                        titulo: object.title,
                        descripcion: object.description,
                        cuerpo: object.description,
                        img: object.img,
                        url: object.url,
                        fecha: fecha,
                        fechaClasica: fechaClasica,
                        fuente: 'yandex',
                        tags: arraytags,
                        idioma: 'es',
                    })
                })
                /* if (Arraydata.length == i + 1) {
                    j++
                } */
                batch.commit().then(async function () {
                    await console.log('Done.')
                    if (Arraydata.length == i + 1) {
                        j++
                        return
                    }
                }).catch(err => console.log(`There was an error: ${err}`))
            }).catch(error => {
                console.log(error);
            })
        } else {
            j++
        }
    }
}

async function seekingalpha() {
    console.log("tag length :" + tags.length)
    for (let j = 0; tags.length > 0;) {
        if (tags[j] !== "Comment gagner un million d'euros" && tags[j]) {
            console.log("tag :" + tags[j])
            let seekingalpha_tag = tags[j].replace(/'/g, '');
            seekingalpha_tag = encodeURI(tags[j]);
            let url_seekingalpha = 'https://r4rrlsfs4a.execute-api.us-west-2.amazonaws.com/production/search?q=(and+%27' + seekingalpha_tag + '%27+(and+content_type:%27news%27)+(or+primary_symbols:%27%27))&q.parser=structured&sort=rank1+desc&size=10&q.options=%7B%22fields%22%3A%5B%22author%22%2C%22author_url%22%2C%22content%5E1%22%2C%22content_type%22%2C%22image_url%22%2C%22primary_symbols%22%2C%22secondary_symbols%22%2C%22summary%22%2C%22tags%22%2C%22title%5E3%22%2C%22uri%22%5D%7D&highlight.title=%7Bpre_tag%3A%27%3Cstrong%3E%27%2Cpost_tag%3A%27%3C%3C%3C%3Cstrong%3E%27%7D&highlight.summary=%7Bpre_tag%3A%27%3Cstrong%3E%27%2Cpost_tag%3A%27%3C%3C%3C%3Cstrong%3E%27%7D&highlight.content=%7Bpre_tag%3A%27%3Cstrong%3E%27%2Cpost_tag%3A%27%3C%3C%3C%3Cstrong%3E%27%7D&highlight.author=%7Bpre_tag%3A%27%3Cstrong%3E%27%2Cpost_tag%3A%27%3C%3C%3C%3Cstrong%3E%27%7D&highlight.primary_symbols=%7Bpre_tag%3A%27%3Cstrong%3E%27%2Cpost_tag%3A%27%3C%3C%3C%3Cstrong%3E%27%7D'
            await axios({
                method: 'get',
                url: url_seekingalpha,
            }).then(async function (response) {
                const batch = db.batch();
                getData(response.data.hits ? response.data.hits.hit : "", "seekingalpha", seekingalpha_tag);
                await Arraydata.forEach(function (object, i, array) {
                    let tempdate = object.date ? moment(object.date).format() : new Date();
                    let fechaTemp = parseInt(moment(tempdate).format("x") / 1000);
                    let fechaClasicaTemp = new Date(tempdate).toISOString()
                    let arraytags = [];
                    arraytags.push(seekingalpha_tag);
                    if (object.description && object.description.length > 0 && object.url && object.url.length > 0) {
                        let unique_id_seekingalpha = db.collection("my_collection").doc().id + "_seekingApha";
                        let unique_url_seekingalpha = encodeURIComponent(object.url);
                        const Ref = db.collection('noticias2').doc(unique_url_seekingalpha)
                        console.log("enter firebase forEach")
                        batch.set(Ref, {
                            id: uuidv4(),
                            titulo: object.title,
                            descripcion: object.description,
                            cuerpo: object.description,
                            img: 'https://firebasestorage.googleapis.com/v0/b/autofeed2020.appspot.com/o/img%2Fwhitelogo.png?alt=media&token=e9002688-358a-4997-94b0-31b460635c01',//object.img,
                            url: object.url,
                            fecha: fechaTemp,
                            fechaClasica: fechaClasicaTemp,
                            fuente: 'seekingalpha',
                            tags: arraytags,
                            idioma: 'es',
                        })
                    }
                    if (Arraydata.length == i + 1) {
                        j++
                    }
                })
                batch.commit().then(async function () {
                    await console.log('Done.')
                }).catch(err => console.log(`There was an error: ${err}`))
            }).catch(error => {
                console.log(error);
            })
        } else {
            if (tags.length == j) {
                console.log("tags.length  " + j)
                console.log("break  " + j)
                break
            } else {
                console.log("undefined  " + j)
                j++
            }
        }
    }
}


async function getData(html, type, tags) {
    Arraydata = [{
        titulo: "",
        descripcion: "",
        cuerpo: "",
        img: "",
        url: "",
        fecha: fecha,
        fechaClasica: fechaClasica,
        fuente: '',
        tags: '',
        idioma: '',
    }];
    if (type == "yandexNews") {
        const $ = cheerio.load(html);
        $('ul.search-list li').each(async function () {
            title = $(this).find('div.document.i-bem h2 a').text();
            description = $(this).find('div.document.i-bem div.document__snippet').text();
            img = $(this).find('div.document.i-bem div.document__provider img').attr("src");
            url = $(this).find('div.document.i-bem h2 a').attr("href");
            tag = tags;
            await Arraydata.push({
                title: title,
                description: description,
                img: img,
                url: url,
                tag: tag,
                language: "es"
            });
        });
    } else if (type == "seekingalpha") {
        if (html) {
            html.forEach(async function (object, i, array) {
                const text = htmlToText.fromString(object.highlights.content, {
                    wordwrap: 130
                });
                let title = object.fields.title;
                let description = text.replace(/([[UAA]], [[UA]])/g, '')
                description = description.replace(/&period/g, '')
                description = description.replace(/([[GOOGL]])/g, '')
                description = description.replace(/[[PRFT]]/g, '')
                description = description.replace(/[[HNHAF]]/g, '')
                description = description.replace(/[[HNHPD]]/g, '')
                description = description.replace(/[[GOOG]]/g, '')
                description = description.replace(/[[UAA]]/g, '')
                description = description.replace(/[[CIDM]]/g, '');
                description = description.replace(/[[INT]/g, '');
                description = description.replace(/<<</g, '');
                let img = 'https://seekingalpha.com' + object.fields.image_url;
                let url = 'https://seekingalpha.com' + object.fields.uri;
                let tag = tags;
                let date = object.fields.publish_date;
                await Arraydata.push({
                    title: title,
                    description: description,
                    img: img,
                    url: url,
                    tag: tag,
                    date: date,
                    language: "es"
                });
            });
        }
    }
    News_found = Arraydata.length > 1 ? "Yes" : "No";
    Arraydata.length > 1 ? Arraydata.shift() : Arraydata;
}

async function getDefaultImages() {
    for (let m = 0; googleSearchImagesArray.length > 0;) {
        if (googleSearchImagesArray[m].title.length > 0) {
            console.log("title "+googleSearchImagesArray[m].title)
            console.log("index "+m)
            let getGoogleImageURL = "https://www.google.com/search?q=" + googleSearchImagesArray[m].title + "&source=lnms&tbm=isch"
            await axios({
                method: 'get',
                url: getGoogleImageURL,
            }).then(async function (response) {
                let getImage = await response.data;
                const $ = await cheerio.load(getImage);
                    let image = $('img.t0fcAb').attr("src");
                    console.log(image)
                    await db.collection('noticias2').doc(googleSearchImagesArray[m].idOfDocument).update({
                        img: image
                    }).then(async() => {
                        await console.log("image added in noticias")
                        m++
                    }).catch(async error => {
                        await console.log("google Image search function error" + error)
                        m++
                    })
            }).catch(async error => {
                await console.log("Image not found" + error)
                m++
            })
        } else {
            if (googleSearchImagesArray.length == m) {
                console.log("googleSearchImagesArray.length  " + m)
                console.log("break  " + m)
                break
            } else {
                console.log("increase outter  " + m)
                m++
            }
        }
    }
}

getAlltags();

exports.app = functions.https.onRequest(app);