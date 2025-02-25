import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Docker from 'dockerode';

const app = express();
const docker = new Docker();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

/**
 * Обработчик POST-запроса для запуска кода в Docker.
 *
 * @param {Request} req - Объект запроса.
 * @param {Response} res - Объект ответа.
 * @throws {Error} - Если язык не поддерживается.
 */
app.post('/run', async (req: Request, res: Response): Promise<void> => {
    const { language, code } = req.body as { language: string; code: string };

    console.log(`Получен запрос на выполнение кода на языке: ${language}`);

    try {
        const output = await runCode(language, code);
        console.log(`Код выполнен успешно. Вывод: ${output}`);
        res.send(cleanOutput(output));

    } catch (error) {
        console.error(`Ошибка при выполнении кода: ${(error as Error).message}`);
        res.status(500).send((error as Error).message);
    }
});

/**
 * Общая функция для запуска кода в Docker.
 *
 * @param {string} language - Язык программирования.
 * @param {string} code - Код для запуска.
 * @returns {Promise<string>} - Вывод кода.
 * @throws {Error} - Если язык не поддерживается.
 */
async function runCode(language: string, code: string): Promise<string> {
    let image: string;
    let cmd: string[];

    switch (language) {
        case 'js':
            image = 'node:14';
            cmd = ['node', '-e', code]; // Передаем команду как массив
            break;
        case 'python':
            image = 'python:3.9';
            cmd = ['python', '-c', code]; // Передаем команду как массив
            break;
        case 'cpp':
            image = 'gcc:latest';
            cmd = ['bash', '-c', `echo "${code}" > main.cpp && g++ main.cpp -o main && ./main`]; // Передаем команду как массив
            break;
        case 'ts':
            image = 'node:14';
            cmd = ['bash', '-c', `npm install -g typescript && echo "${code}" > main.ts && tsc main.ts && node main.js`]; // Передаем команду как массив
            break;
        default:
            throw new Error('Unsupported language');
    }

    console.log(`Создание контейнера с образом: ${image}`);
    const container = await docker.createContainer({
        Image: image,
        Cmd: cmd, // Передаем команду как массив
        Tty: false,
    });

    console.log(`Запуск контейнера...`);
    await container.start();
    const stream = await container.logs({ stdout: true, stderr: true, follow: true });

    let output = '';
    stream.on('data', (chunk) => (output += chunk.toString()));

    await new Promise((resolve) => {
        stream.on('end', resolve);
    });

    console.log(`Удаление контейнера...`);
    await container.remove(); // Удаляем контейнер после получения логов
    return output;
}

/**
 * Функция для очистки вывода.
 *
 * @param {string} output - Вывод кода.
 * @returns {string} - Очищенный вывод.
 */
function cleanOutput(output: string): string {
    return output
        .replace(/\s+/g, ' ') // Заменяем несколько пробелов на один
        .trim() // Убираем пробелы в начале и конце
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Удаляем управляющие символы
}

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
