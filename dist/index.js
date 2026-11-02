"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const R_TERRA = 6371000; // Raio da Terra em metros
const LIMITE_DISTANCIA = 20; // 20 metros
// Fórmula de Haversine otimizada
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
    const toRad = (graus) => (graus * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R_TERRA * c;
}
// Função auxiliar para baixar arquivos via URL se necessário
function baixarArquivo(url, destino) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destino);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Falha ao baixar ${url}, status: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destino, () => { });
            reject(err);
        });
    });
}
async function processarDataset(caminhoArquivo, caminhoSaida) {
    console.time(`Processamento ${path.basename(caminhoArquivo)}`);
    const fileStream = fs.createReadStream(caminhoArquivo);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    // Agrupamento por timestamp: Map<timestamp, Map<idMonitorado, Posicao>>
    const dadosPorTimestamp = new Map();
    let cabecalhoLido = false;
    for await (const line of rl) {
        if (!line.trim())
            continue;
        if (!cabecalhoLido) {
            cabecalhoLido = true;
            continue; // Pula o cabeçalho
        }
        const partes = line.split(';');
        if (partes.length < 7)
            continue;
        const idMonitorado = Number(partes[0]);
        const faccaoMonitorado = partes[1].trim();
        const timestamp = partes[2].trim();
        const latitude = parseFloat(partes[3]);
        const longitude = parseFloat(partes[4]);
        const medidaProtetiva = partes[5].toLowerCase() === 'true';
        let idsRestricaoMedida = [];
        if (partes[6] && partes[6].trim() !== '') {
            idsRestricaoMedida = partes[6].split(',').map(Number);
        }
        const posicao = {
            idMonitorado,
            faccaoMonitorado,
            timestamp,
            latitude,
            longitude,
            medidaProtetiva,
            idsRestricaoMedida
        };
        if (!dadosPorTimestamp.has(timestamp)) {
            dadosPorTimestamp.set(timestamp, new Map());
        }
        dadosPorTimestamp.get(timestamp).set(idMonitorado, posicao);
    }
    const encontros = [];
    // Processar cada timestamp
    for (const [timestamp, monitoradosMap] of dadosPorTimestamp.entries()) {
        const monitorados = Array.from(monitoradosMap.values());
        const n = monitorados.length;
        // Comparação de pares sem repetição (i < j)
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const p1 = monitorados[i];
                const p2 = monitorados[j];
                const distancia = calcularDistanciaHaversine(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
                if (distancia < LIMITE_DISTANCIA) {
                    const idsOrdenados = p1.idMonitorado < p2.idMonitorado
                        ? [p1.idMonitorado, p2.idMonitorado]
                        : [p2.idMonitorado, p1.idMonitorado];
                    const posicoesObj = {
                        [p1.idMonitorado]: { lat: p1.latitude, lon: p1.longitude },
                        [p2.idMonitorado]: { lat: p2.latitude, lon: p2.longitude }
                    };
                    // 1. Encontro de Medida Protetiva
                    // Ocorre entre um agressor e sua respectiva vítima
                    const p1EhAgressoresDeP2 = p1.medidaProtetiva && p1.idsRestricaoMedida.includes(p2.idMonitorado);
                    const p2EhAgressoresDeP1 = p2.medidaProtetiva && p2.idsRestricaoMedida.includes(p1.idMonitorado);
                    if (p1EhAgressoresDeP2 || p2EhAgressoresDeP1) {
                        encontros.push({
                            tipo: 'protetiva',
                            monitoradosEncontro: idsOrdenados,
                            timestamp,
                            posicoes: posicoesObj,
                            distanciaMetros: distancia
                        });
                    }
                    // 2. Encontro de Facção
                    // Ocorre entre dois monitorados que pertencem à mesma facção (facção preenchida e igual)
                    if (p1.faccaoMonitorado && p2.faccaoMonitorado && p1.faccaoMonitorado === p2.faccaoMonitorado) {
                        encontros.push({
                            tipo: 'faccao',
                            monitoradosEncontro: idsOrdenados,
                            timestamp,
                            posicoes: posicoesObj,
                            distanciaMetros: distancia
                        });
                    }
                    // 3. Encontro Genérico
                    // Encontro entre quaisquer dois monitorados
                    encontros.push({
                        tipo: 'generico',
                        monitoradosEncontro: idsOrdenados,
                        timestamp,
                        posicoes: posicoesObj,
                        distanciaMetros: distancia
                    });
                }
            }
        }
    }
    // Salvar arquivo de output JSON
    fs.writeFileSync(caminhoSaida, JSON.stringify(encontros, null, 2), 'utf-8');
    console.timeEnd(`Processamento ${path.basename(caminhoArquivo)}`);
    console.log(`Arquivo gerado com sucesso: ${caminhoSaida} (${encontros.length} encontros detectados)\n`);
}
async function executar() {
    const datasets = [
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset1.txt', nome: 'dataset1.txt', saida: 'respostas1.json' },
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset2.txt', nome: 'dataset2.txt', saida: 'respostas2.json' },
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset3.txt', nome: 'dataset3.txt', saida: 'respostas3.json' },
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset4.txt', nome: 'dataset4.txt', saida: 'respostas4.json' },
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset5.txt', nome: 'dataset5.txt', saida: 'respostas5.json' },
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset6.txt', nome: 'dataset6.txt', saida: 'respostas6.json' },
        { url: 'https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset7.txt', nome: 'dataset7.txt', saida: 'respostas7.json' },
    ];
    const dirInput = path.join(__dirname, '../inputs');
    const dirOutput = path.join(__dirname, '../outputs');
    if (!fs.existsSync(dirInput))
        fs.mkdirSync(dirInput, { recursive: true });
    if (!fs.existsSync(dirOutput))
        fs.mkdirSync(dirOutput, { recursive: true });
    for (const ds of datasets) {
        const caminhoInput = path.join(dirInput, ds.nome);
        const caminhoSaida = path.join(dirOutput, ds.saida);
        console.log(`Baixando/Verificando ${ds.nome}...`);
        try {
            await baixarArquivo(ds.url, caminhoInput);
            await processarDataset(caminhoInput, caminhoSaida);
        }
        catch (error) {
            console.error(`Erro ao processar ${ds.nome}:`, error);
        }
    }
}
executar();
