# Receipt Rating Backend

## Setup

Installing all necessary dependencies with:
```console
npm install
```

Build the solution using the following command:
```console
npm run build
```

Run the service in development mode with hot refresh
```console
npm run dev
```

Start the service with:
```console
npm run start
```


## Folder Structure 
The folder structure of the Node.js application is the following: 

-	**controllers** comprises the controller functions for resolving, providing, updating, adding and deleting of receipts, products and user information.

-	**middleware** contains the methods to authenticate the user through the token included in the request and to add the id of the user to the request before he passes it on.

-	**models** includes interfaces describing the composition of data types like the data structure of a product in the database. 

-	**resources** comprehends the swagger file for describing the API interface

-	**routes** determine how a response to a client request at a particular endpoint will respond. It contains the Uniform Resource Identifier (URI) and the specific HTTP request method.

-	**services** contains methods regarding getting, adding, updating and deleting receipt, product information from the database or to communicate with the Azure service.

## Controllers and Routes
In the following, the controllers of the backend are listed, and their tasks are described. For a more detailed overview of what types the interface expects and what responses an interface can give, see the documentation of Swagger. To access **Swagger UI**, start the backend with `npm run dev` and go to http://localhost:8081/docs in your browser 

##	Azure Form Recognizer
Azure is a cloud computing service developed by Microsoft. It provides Infrastructure as a Service, Platform as a Service and Software as a Service supporting multiple programming languages. The Form Recognizer is a resource on Azure which can return information that is on a receipt as JSON data. More information about the service can be found under the following link:
https://docs.microsoft.com/en-us/azure/applied-ai-services/form-recognizer/concept-receipt 

#### Setup
To setup the Azure Form Recognizer service one has to create an Azure account first. As a student, you can set up a student account for this, which already has $100 in starting credit. However, 500 requests per month are also free of charge when using the account: https://azure.microsoft.com/en-us/free/students/

To create a Form Recognizer resource, follow the tutorial on this site: https://docs.microsoft.com/en-us/azure/applied-ai-services/form-recognizer/quickstarts/try-sample-label-tool 

After the creation of the resource, one has access to the endpoint URL and the API key. To try out the service (Endpoint URL and API key needed) visit:
https://fott-2-1.azurewebsites.net/prebuilts-analyze 

#### Integration in the backend
To access the Azure form recognizer API from the application the `ai-form-recognizer` package is required. More about the package and the installation can be found here: 
https://docs.microsoft.com/en-us/azure/applied-ai-services/form-recognizer/how-to-guides/try-sdk-rest-api?pivots=programming-language-javascript 

When you install all dependencies off the Node.js application, the `ai-form-recognizer` is already installed. The only necessary step to connect the application to the Azure Form Recognizer API is to specify the Endpoint and API key in the `config.ts` file:

```javascript
const apiKey = "API_KEY";
const endpoint = "ENDPOINT_URL";
export const formRecognizerClient = new FormRecognizerClient(
      endpoint, new AzureKeyCredential(apiKey)
);
```

When a POST-request is sent to the `/receipt` endpoint the image is sent to Azure by using the `formRecognizerClient` created in the `config.ts` file. The following lines of code can be found in `imageServices.ts` under the services folder:

```javascript
const file = fs.createReadStream(fileUrl)
const poller = await formRecognizerClient.beginRecognizeReceipts(file,
    {
        contentType: "image/png",
    }
);

const receipts = await poller.pollUntilDone();
```

#### Response of the Azure Form Recognizer
After fetching the results, the data is structure as a JSON and contains the following information if detected: 
-	Merchant
-	Address
-	Phone number
-	Date
-	Time
-	Subtotal
-	Tax
-	Total
-	Line items

The data is then converted to our data format mainly to remove data that is not needed for the app's purpose.


