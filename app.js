const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
//const https = require('https');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const cors = require('cors');
const server = express();
const bodyParser = require("body-parser");
const mysql = require('mysql2');

// const sslServer = https.createServer(
//   {
//     key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
//     cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
//   },
//   server
// );

const BUCKET_NAME = process.env.BUCKET_NAME;
const BUCKET_REGION = process.env.BUCKET_REGION;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  region: BUCKET_REGION
})

// Call Angularjs frontend development 
server.use(express.static('namu-mgmt-frontend'));

server.use(bodyParser.json());
server.use(cors());

//server.listen(8080, function () {
server.listen(8080, function () {
  console.log('listening on 8080')
});

//sslServer.listen(3443, () => console.log('Secure server listening on 3443'))

const db = mysql.createConnection({
  //host : 'localhost',
  host : process.env.DATABASE_URL,
  //user : 'root',
  user : process.env.DATABASE_USER,
  password : process.env.DATABASE_PASSWORD,
  //database : 'SimpleCommerceManagement'
  database : process.env.DATABASE_NAME
});

db.connect(function(err) {
  if (err) {
    console.error('Database Connect Failed :' + err.stack);
    return;
  }
  console.log('Database Connected');
});

// CATEGORY ITEM SEARCH
server.get('/api/Category/:no', function(req,res) {
  var categoryNo = req.params.no;
  let sql = 'SELECT * FROM category WHERE `no` =' + categoryNo;
  db.query(sql, function(error, result, field) {
    if (error) { 
      res.send(error.message);
    } else {
      res.send(result[0]);
    }
  });
});

// CATEGORY ITEM CREATE
server.post('/api/Category', function(req,res) {
  // INSERT INTO SimpleCommerceManagement.category (name, `desc`, isUse, createdTime, updatedTime) VALUES('', '', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  let formData = {
    no : req.body.no,
    name : req.body.name,
    desc : req.body.desc,
    isUse : req.body.isUse,
    createdTime : req.body.createdTime,
    updatedTime : req.body.updatedTime,
  };

  let sql = "INSERT INTO category SET ?";
  db.query(sql, formData, function(error, result, field) {
    if (error) { 
      res.send(error);
    } else {
      res.send(result);
    }
  });
});

// CATEGORY ITEM UPDATE
server.put('/api/Category/:no', function(req,res) {
  let sql = 
  "UPDATE category SET name='" +
  req.body.name +
  "', `desc`='" +
  req.body.desc +
  "', isUse=" +
  req.body.isUse +
  ", createdTime=STR_TO_DATE('" +
  req.body.createdTime +
  "','%Y-%m-%dT%H:%i:%s.000Z'), updatedTime=STR_TO_DATE('" +
  req.body.updatedTime +
  "','%Y-%m-%dT%H:%i:%s.000Z') WHERE `no`=" +
  req.params.no;

  db.query(sql, function(error, result) {
    if (error) { 
      res.send(error);
    } else {
      res.send(result);
    }
  });
});

// CATEGORY ITEM DELETE
server.delete('/api/Category/:no', function(req,res) {
  var categoryNo = req.params.no;
  let sql = "DELETE FROM category WHERE `no` =" + categoryNo;
  db.query(sql, function(error, result, field) {
    if (error) { 
      res.send(error.message);
    } else {
      res.send(result[0]);
    }
  });
});

// PRODUCT ITEM SEARCH
server.get('/api/Product/:no', function(req,res) {
  var productNo = req.params.no;
  let sql = 'SELECT * FROM product WHERE `no` =' + productNo;
  db.query(sql, function(error, result, field) {
    if (error) { 
      res.send(error);
    } else {
      res.send(result[0]);
    }
  });
});

// PRODUCTLIST GET COUNT
server.get('/api/ProductListGetCountAll', function(req,res) {
  let sql = 'SELECT count(*) AS count FROM product';

  db.query(sql, function (error, result, field) {
    if (error) { 
      res.send(error);
    } else {
      res.send(result);
    }
  });
})

// PRODUCTLIST GET BY QUERY
server.post('/api/ProductListGetByQuery', function(req,res) {
  let details = {
    queryOptionName : req.body.queryOptionName,
    queryOptionValue : req.body.queryOptionValue
  }
  
  let sql = '';

  if(details.queryOptionName == "status"){
    sql += 'SELECT * FROM product WHERE status = ?';
  }else if(details.queryOptionName === "catNo"){
    sql += 'SELECT * FROM product WHERE catNo = ?';
  }

  db.query(sql, details.queryOptionValue, function (error, result, field) {
    if (error) { 
      res.send(error);
    } else {   
      res.send(result);
    }
  });
})

// PRODUCTLIST GET BY PAGE
server.post('/api/ProductListGetByPage', function(req,res) {
  let body = {
    offset : req.body.offset == null ? req.body.pageSize : req.body.offset,
    pageSize : req.body.pageSize
  }
  
  let sql = 
    'SELECT * ' +
    'FROM ' +
    '( ' +
    'SELECT ROW_NUMBER() OVER(ORDER BY `no` ASC) AS rowNum, product.* ' +
    'FROM product' +
    ') AS tmpProduct ' +
    'WHERE rowNum BETWEEN ' + (body.offset - body.pageSize + 1) + ' AND ' + body.offset + ' ' +
    'ORDER BY rowNum DESC LIMIT ' + body.pageSize;

  db.query(sql, function (error, result, field) {
    if (error) { 
      res.send(error);
    } else {   
      res.send(result);
    }
  });
})



// PRODUCT ITEM CREATE
server.post('/api/Product', upload.single('productImage'), async function(req,res) {
  const originalBuffer = req.file.buffer;
  let originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

  let ext = originalName.split('.').pop();
  let fileName = originalName.split('.').slice(0, -1).join('.');
  let fullFileName = fileName + '-' + Date.now()+'.'+ext;

  const processedBuffer = await sharp(originalBuffer)
  .resize({ width: 500 })
  .jpeg()
  .toBuffer();

  const params = {
    Bucket: BUCKET_NAME,
    Key: fullFileName,
    Body: processedBuffer,
    ContentType: 'image/jpeg' 
  }

  try {
    const putObjectCommand = new PutObjectCommand(params);
    const createResponse = await s3.send(putObjectCommand);
    
    let imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fullFileName}`;
    let formData = {
      no : parseInt(req.body.no),
      name : req.body.name,
      listPrice : parseInt(req.body.listPrice),
      isUse : parseInt(req.body.isUse),
      status : parseInt(req.body.status),
      qty : parseInt(req.body.qty),
      desc : req.body.desc,
      productImage : fullFileName,
      productImageUrl : imageUrl,
      catNo : parseInt(req.body.catNo),
      createdTime : new Date(req.body.createdTime).toISOString().slice(0, 19).replace('T', ' '),
      updatedTime : new Date(req.body.updatedTime).toISOString().slice(0, 19).replace('T', ' ')
    };

    if (typeof formData.catNo !== 'number' || isNaN(formData.catNo)) {
      throw new Error('Invalid catNo');
    }

    let sql = "INSERT INTO product SET ?";
    db.query(sql, formData, function(error, result, field) {
      if (error) { 
        res.send(error);
      } else {
        res.send(result);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: 'Invalid request' });
  }
});

// PRODUCT ITEM UPDATE
server.put('/api/Product/:no', upload.single('productImage'), async function(req,res) {
  try {
    var imageUrl = null;
    var fullFileName = null;

    if(req.file){
      let originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const originalBuffer = req.file.buffer;

      let ext = originalName.split('.').pop();
      let fileName = originalName.split('.').slice(0, -1).join('.');
      fullFileName = fileName + '-' + Date.now()+'.'+ext;

      const processedBuffer = await sharp(originalBuffer)
      .resize({ width: 500 })
      .jpeg()
      .toBuffer();

      const params = {
        Bucket: BUCKET_NAME,
        Key: fullFileName,
        Body: processedBuffer,
        ContentType: 'image/jpeg' 
      }

      const putObjectCommand = new PutObjectCommand(params);
      const updateResponse = await s3.send(putObjectCommand);
      
      imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fullFileName}`;
    }
    
    let formData = {
      no : parseInt(req.body.no),
      name : req.body.name,
      listPrice : parseInt(req.body.listPrice),
      isUse : parseInt(req.body.isUse),
      status : parseInt(req.body.status),
      qty : parseInt(req.body.qty),
      desc : req.body.desc,
      productImage : fullFileName === null ? req.body.productImage : fullFileName,
      productImageUrl : imageUrl === null ? req.body.productImageUrl : imageUrl, 
      catNo : parseInt(req.body.catNo),
      createdTime : req.body.createdTime,
      updatedTime : req.body.updatedTime
    };

    let sql = 
    "UPDATE product SET name='" +
    formData.name +
    "', `desc`='" +
    formData.desc +
    "', isUse=" +
    formData.isUse +
    ", listPrice=" +
    formData.listPrice +
    ", status=" +
    formData.status +
    ", qty=" +
    formData.qty +
    ", catNo=" +
    formData.catNo +
    ", productImage='" +
    formData.productImage +
    "', productImageUrl='" +
    formData.productImageUrl +
    "', createdTime=STR_TO_DATE('" +
    formData.createdTime +
    "','%Y-%m-%dT%H:%i:%s.000Z'), updatedTime=STR_TO_DATE('" +
    formData.updatedTime +
    "','%Y-%m-%dT%H:%i:%s.000Z') WHERE `no`=" +
    formData.no;

    db.query(sql, async function(error, result) {
      if (error) { 
        res.send(error);
      } else {
        if(req.file){
          var deleteFileName = req.body.origProductImage;
          
          const deleteParams = {
            Bucket: BUCKET_NAME,
            Key: deleteFileName, // fileName 값을 사용합니다.
          };

          const deleteCommand = new DeleteObjectCommand(deleteParams);
          
          try{
            const responseDelete = await s3.send(deleteCommand);
          } catch(err) {
            res.send(err.message);
          }
        }
        res.send(result);
      }
    });
  } catch (error) {
    res.status(400).send({ error: 'Invalid request' });
  }
});

// PRODUCT ITEM DELETE
server.delete('/api/Product/:no', function(req,res) {
  var productNo = req.params.no;
  var fileName = req.query.fileName;

  let sql = "DELETE FROM product WHERE `no` =" + productNo;
  db.query(sql, async function(error, result, field) {
    if (error) { 
      res.send(error.message);
    } else {
      const params = {
        Bucket: BUCKET_NAME,
        Key: fileName, // fileName 값을 사용합니다.
      };

      const deleteCommand = new DeleteObjectCommand(params);
      
      try{
        const data = await s3.send(deleteCommand);
        res.send(result[0]);
      } catch(err) {
        res.send(err.message);
      }
    }
  });
});

// CATEGORYLIST GET COUNTALL
server.get('/api/CategoryListGetCountAll', function(req,res) {
  db.query('SELECT count(*) AS count FROM category', function (error, result, field) {
    if (error) { 
      res.send(error);
    } else {
      res.send(result);
    }
  });
})

// CATEGORYLIST GET LIST BY QUERY
server.post('/api/CategoryListGetByQuery', function(req,res) {
  let sql = 'SELECT `no`,name,`desc`,IF(isUse,true,false) AS isUse, createdTime, updatedTime FROM category WHERE isUse = ?';

  db.query(sql, req.body.queryOptionValue, function (error, result, field) {
    if (error) {
      res.send(error);
    } else {
      res.send(result);
    }
  });
})

// CATEGORYLIST GET LIST BY PAGE
server.post('/api/CategoryListGetByPage', function(req,res) {
  let body = {
    offset : req.body.offset == null ? req.body.pageSize : req.body.offset,
    pageSize : req.body.pageSize
  }
  
  let sql = 
    'SELECT `no`,name,`desc`,IF(isUse,true,false) AS isUse, createdTime, updatedTime ' +
    'FROM ' +
    '( ' +
    'SELECT ROW_NUMBER() OVER(ORDER BY `no` ASC) AS rowNum, category.* ' +
    'FROM category' +
    ') AS tmpCategory ' +
    'WHERE rowNum BETWEEN ' + (body.offset - body.pageSize + 1) + ' AND ' + body.offset + ' ' +
    'ORDER BY rowNum DESC LIMIT ' + body.pageSize;

  db.query(sql, function (error, result, field) {
    if (error) { 
      res.send(error);
    } else {   
      res.send(result);
    }
  });
})

// GET CATEGORY 
server.get('/api/Category', function(req,res) {
  db.query('SELECT `no`,name,`desc`, IF(isUse,true,false) AS isUse, createdTime, updatedTime FROM category', function (error, result, field) {
    if (error) { 
      res.send(error);
    } else {
      res.send(result);
    }
  });
})