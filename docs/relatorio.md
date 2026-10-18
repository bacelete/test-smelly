# Capa

**Disciplina:** [NOME DA DISCIPLINA]
**Trabalho:** Refatoração de Testes e Detecção de Test Smells
**Aluno:** [NOME COMPLETO]
**Matrícula:** [MATRÍCULA]
**Repositório:** https://github.com/bacelete/test-smelly

---

## 1. Análise de Smells

A suíte `test/userService.smelly.test.js` passa por completo, mas apresenta vários *test smells*. Destaco três.

### 1.1 Lógica Condicional no Teste (Conditional Test Logic)

**Onde:** teste *"deve desativar usuários se eles não forem administradores"*.

O teste percorre uma lista com `for` e decide com `if/else` quais asserções executar para cada usuário. Na prática são dois cenários diferentes (usuário comum e administrador) misturados num só teste.

**Por que é um mau cheiro:** o teste deixa de ser uma sequência linear e previsível de passos. Para saber o que está sendo verificado, é preciso "executar o código de cabeça". Se a lista ficar vazia ou o `if` tomar sempre o mesmo caminho, parte das asserções nunca roda e o teste continua verde.

**Risco:** falsos positivos. Um bug na regra de administrador pode passar despercebido, e uma falha não diz qual cenário quebrou.

### 1.2 Tratamento de Exceção Silencioso (Exception Handling / teste que não falha)

**Onde:** teste *"deve falhar ao criar usuário menor de idade"*.

O `expect` está dentro de um `catch`. Se `createUser` **não** lançar exceção, o `catch` não roda, nenhuma asserção é executada e o Jest considera o teste aprovado.

**Por que é um mau cheiro:** o teste só verifica a mensagem de erro *quando* o erro acontece, não verifica *que* ele acontece.

**Risco:** é o smell mais perigoso da suíte. Para comprovar, removi temporariamente a validação `idade < 18` de `userService.js`: a suíte original continuou **100% verde**, enquanto a suíte refatorada falhou imediatamente (seção 3). Na prática, é o mesmo "mutante sobrevivente" do trabalho anterior.

### 1.3 Teste Frágil / Igualdade Sensível (Fragile Test / Sensitive Equality)

**Onde:** teste *"deve gerar um relatório de usuários formatado"*.

O teste monta a linha esperada caractere por caractere (`ID: ..., Nome: Alice, Status: ativo\n`) e exige que o relatório comece com um cabeçalho exato.

**Por que é um mau cheiro:** o teste fica acoplado ao *formato* da saída, não ao *conteúdo*. O próprio código-fonte avisa que "o formato do relatório pode mudar no futuro".

**Risco:** qualquer mudança cosmética, como um espaço, a ordem dos campos ou o texto do cabeçalho, quebra o teste sem que exista bug. Isso gera manutenção desnecessária e faz a equipe perder a confiança na suíte.

### Outros smells encontrados

- **Eager Test:** *"deve criar e buscar um usuário corretamente"* testa duas operações (`createUser` e `getUserById`), com dois "Act" no mesmo teste.
- **Teste Desabilitado / Vazio:** `test.skip` com apenas um `TODO`. Ele dá a falsa impressão de que o caso "lista vazia" está coberto.
- **Fixture Geral (General Fixture):** o objeto `dadosUsuarioPadrao` fica no topo do arquivo, mas é usado por um único teste.

---

## 2. Processo de Refatoração

O teste escolhido foi o de desativação de usuários, porque ele reúne lógica condicional, laço e dois cenários num só.

### Antes (`userService.smelly.test.js`)

```js
test('deve desativar usuários se eles não forem administradores', () => {
  const usuarioComum = userService.createUser('Comum', 'comum@teste.com', 30);
  const usuarioAdmin = userService.createUser('Admin', 'admin@teste.com', 40, true);

  const todosOsUsuarios = [usuarioComum, usuarioAdmin];

  for (const user of todosOsUsuarios) {
    const resultado = userService.deactivateUser(user.id);
    if (!user.isAdmin) {
      expect(resultado).toBe(true);
      const usuarioAtualizado = userService.getUserById(user.id);
      expect(usuarioAtualizado.status).toBe('inativo');
    } else {
      expect(resultado).toBe(false);
    }
  }
});
```

### Depois (`userService.clean.test.js`)

```js
describe('deactivateUser', () => {
  test('desativa um usuário comum', () => {
    // Arrange
    const usuarioComum = criarUsuarioComum();

    // Act
    const resultado = userService.deactivateUser(usuarioComum.id);

    // Assert
    expect(resultado).toBe(true);
    expect(userService.getUserById(usuarioComum.id).status).toBe('inativo');
  });

  test('não desativa um usuário administrador', () => {
    // Arrange
    const usuarioAdmin = criarUsuarioAdmin();

    // Act
    const resultado = userService.deactivateUser(usuarioAdmin.id);

    // Assert
    expect(resultado).toBe(false);
    expect(userService.getUserById(usuarioAdmin.id).status).toBe('ativo');
  });

  test('retorna false quando o usuário não existe', () => {
    // Arrange
    const idInexistente = 'id-que-nao-existe';

    // Act
    const resultado = userService.deactivateUser(idInexistente);

    // Assert
    expect(resultado).toBe(false);
  });
});
```

### Decisões tomadas

1. **Um cenário por teste.** O teste original foi dividido em três: usuário comum, administrador e usuário inexistente. Cada um tem nome próprio, então, quando um falha, o nome já diz qual regra quebrou.
2. **Remoção do `for` e do `if`.** Sem lógica condicional, todas as asserções sempre rodam. Isso elimina os erros `jest/no-conditional-expect`.
3. **Padrão AAA explícito.** Os blocos `Arrange`, `Act` e `Assert` estão separados e comentados, e cada teste tem um único `Act`.
4. **Asserção mais forte para o admin.** O original só verificava o retorno `false`. O novo teste também confirma que o status **continua `ativo`**, ou seja, verifica o efeito real da regra de negócio, não só o valor de retorno.
5. **Cenário novo.** O caminho "usuário não encontrado" não era testado no original.
6. **Funções auxiliares** (`criarUsuarioComum`, `criarUsuarioAdmin`) substituem o fixture global e deixam o Arrange curto e legível.

### Como os demais smells foram corrigidos

| Smell original | Correção na suíte limpa |
|---|---|
| `try/catch` com `expect` condicional | `expect(() => ...).toThrow('mensagem')`, que falha se a exceção **não** for lançada |
| Relatório com formato exato | Verifica que o relatório **contém** id, nome e status de cada usuário, sem depender da formatação |
| Eager Test (criar + buscar) | Testes separados em `describe('createUser')` e `describe('getUserById')` |
| `test.skip` vazio | Implementado: *"informa que não há usuários quando o cadastro está vazio"* |
| Casos não cobertos | Novos testes: idade limite (18), campos obrigatórios ausentes (`test.each`), ids únicos e busca por id inexistente |

---

## 3. Relatório da Ferramenta (ESLint)

Configuração usada: `.eslintrc.json` do enunciado, com `eslint@8` e `eslint-plugin-jest@27`. Usei o ESLint 8 porque o 9 não lê mais o formato `.eslintrc.json` e exige Node 18 ou superior.

**Primeira execução (`npx eslint .`):**

> [INSERIR PRINT AQUI. Saída em texto salva em `docs/eslint-antes.txt`]

```
test/userService.smelly.test.js
  44:9  error    Avoid calling `expect` conditionally`  jest/no-conditional-expect
  46:9  error    Avoid calling `expect` conditionally`  jest/no-conditional-expect
  49:9  error    Avoid calling `expect` conditionally`  jest/no-conditional-expect
  73:7  error    Avoid calling `expect` conditionally`  jest/no-conditional-expect
  77:3  warning  Disabled test                          jest/no-disabled-tests
  77:3  warning  Test has no assertions                 jest/expect-expect

✖ 6 problems (4 errors, 2 warnings)
```

**Como a ferramenta automatizou a detecção:**

- As linhas 44, 46 e 49 correspondem ao `if/else` dentro do `for` (Lógica Condicional, seção 1.1).
- A linha 73 é o `expect` dentro do `catch` (Exceção Silenciosa, seção 1.2).
- A linha 77 aponta o `test.skip` vazio de duas formas: teste desabilitado e teste sem asserções.

**Comparação com a análise manual:** o ESLint encontrou automaticamente 2 dos 3 smells principais, além do teste desabilitado. Ele **não** detectou o Teste Frágil (seção 1.3) nem o Eager Test, porque são problemas de *intenção* e de *projeto do teste*, que uma regra sintática não consegue julgar. A análise estática e a revisão humana se complementam.

**Validação final:** `npx eslint test/userService.clean.test.js` não reporta nenhum problema, e `npm test` passa nas duas suítes (19 testes aprovados, 1 ignorado, que é o `skip` original mantido intocado).

---

## 4. Conclusão

A suíte original passava por inteiro e, ainda assim, não protegia o sistema. Ao remover a validação de idade mínima, ela continuou verde, enquanto a suíte refatorada acusou o defeito na hora. Isso confirma o que o trabalho de mutação já tinha mostrado: um teste que passa não é necessariamente um teste que verifica algo.

Testes limpos (um comportamento por teste, padrão AAA, sem lógica condicional e verificando comportamento em vez de formato) cumprem dois papéis. Eles **detectam bugs de fato** e **documentam as regras de negócio**: lendo apenas os nomes dos testes em `deactivateUser`, qualquer pessoa entende a regra de que administradores não podem ser desativados.

Ferramentas de análise estática como o ESLint com `eslint-plugin-jest` tornam essa disciplina sustentável. Rodando no editor ou na esteira de CI, elas barram automaticamente os smells mais mecânicos antes do code review. Assim, a revisão humana pode focar no que a ferramenta não enxerga, como fragilidade e excesso de responsabilidade num mesmo teste.
