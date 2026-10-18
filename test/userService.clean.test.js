const { UserService } = require('../src/userService');

describe('UserService', () => {
  let userService;

  beforeEach(() => {
    userService = new UserService();
    userService._clearDB();
  });

  const criarUsuarioComum = () =>
    userService.createUser('Fulano de Tal', 'fulano@teste.com', 25);

  const criarUsuarioAdmin = () =>
    userService.createUser('Admin', 'admin@teste.com', 40, true);

  describe('createUser', () => {
    test('retorna o usuário com id gerado e os dados informados', () => {
      // Arrange
      const nome = 'Fulano de Tal';
      const email = 'fulano@teste.com';
      const idade = 25;

      // Act
      const usuario = userService.createUser(nome, email, idade);

      // Assert
      expect(usuario.id).toEqual(expect.any(String));
      expect(usuario).toMatchObject({ nome, email, idade });
    });

    test('cria o usuário com status ativo e sem privilégio de admin por padrão', () => {
      // Arrange
      // (nenhuma pré-condição além do banco vazio)

      // Act
      const usuario = criarUsuarioComum();

      // Assert
      expect(usuario.status).toBe('ativo');
      expect(usuario.isAdmin).toBe(false);
    });

    test('gera ids diferentes para usuários diferentes', () => {
      // Arrange
      const primeiro = criarUsuarioComum();

      // Act
      const segundo = criarUsuarioAdmin();

      // Assert
      expect(segundo.id).not.toBe(primeiro.id);
    });

    test('aceita usuário com exatamente 18 anos', () => {
      // Arrange
      const idadeMinima = 18;

      // Act
      const usuario = userService.createUser('Maior', 'maior@teste.com', idadeMinima);

      // Assert
      expect(usuario.idade).toBe(idadeMinima);
    });

    test('lança erro ao criar usuário menor de idade', () => {
      // Arrange
      const criarMenor = () => userService.createUser('Menor', 'menor@teste.com', 17);

      // Act + Assert
      expect(criarMenor).toThrow('O usuário deve ser maior de idade.');
    });

    test.each([
      ['nome', [undefined, 'fulano@teste.com', 25]],
      ['email', ['Fulano', undefined, 25]],
      ['idade', ['Fulano', 'fulano@teste.com', undefined]],
    ])('lança erro quando o campo obrigatório "%s" não é informado', (_campo, argumentos) => {
      // Arrange
      const criarIncompleto = () => userService.createUser(...argumentos);

      // Act + Assert
      expect(criarIncompleto).toThrow('Nome, email e idade são obrigatórios.');
    });
  });

  describe('getUserById', () => {
    test('retorna o usuário cadastrado com o id informado', () => {
      // Arrange
      const usuarioCriado = criarUsuarioComum();

      // Act
      const usuarioBuscado = userService.getUserById(usuarioCriado.id);

      // Assert
      expect(usuarioBuscado).toEqual(usuarioCriado);
    });

    test('retorna null quando o id não existe', () => {
      // Arrange
      const idInexistente = 'id-que-nao-existe';

      // Act
      const resultado = userService.getUserById(idInexistente);

      // Assert
      expect(resultado).toBeNull();
    });
  });

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

  describe('generateUserReport', () => {
    test('inclui id, nome e status de cada usuário cadastrado', () => {
      // Arrange
      const alice = userService.createUser('Alice', 'alice@email.com', 28);
      const bob = userService.createUser('Bob', 'bob@email.com', 32);
      userService.deactivateUser(bob.id);

      // Act
      const relatorio = userService.generateUserReport();

      // Assert
      expect(relatorio).toContain(alice.id);
      expect(relatorio).toContain('Alice');
      expect(relatorio).toContain(bob.id);
      expect(relatorio).toContain('Bob');
      expect(relatorio).toContain('inativo');
    });

    test('informa que não há usuários quando o cadastro está vazio', () => {
      // Arrange
      // (banco limpo no beforeEach)

      // Act
      const relatorio = userService.generateUserReport();

      // Assert
      expect(relatorio).toContain('Nenhum usuário cadastrado.');
    });
  });
});
