// ============================================================================
// QuestionsController
// ============================================================================

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { QuestionsService } from './questions.service';
import { CreateQuestionDto, CreateAnswerDto } from './dto/questions.dto';
import { CurrentUser, AuthUser, ClientIp, Roles } from '../common/decorators';

@ApiTags('Consultas')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // --------------------------------------------------------------------------
  // PARENT
  // --------------------------------------------------------------------------
  @Roles(UserRole.PARENT)
  @Post()
  @ApiOperation({ summary: 'Crear nueva consulta' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateQuestionDto,
    @ClientIp() ip: string,
  ) {
    return this.questionsService.create(user.sub, user.role, dto, ip);
  }

  // --------------------------------------------------------------------------
  // PARENT + SPECIALIST + ADMIN — RLS filtra
  // --------------------------------------------------------------------------
  @Get()
  @ApiOperation({ summary: 'Listar consultas (filtrado por RLS según rol)' })
  list(@CurrentUser() user: AuthUser) {
    return this.questionsService.list(user.sub, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una consulta' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.questionsService.getOne(user.sub, user.role, id);
  }

  // --------------------------------------------------------------------------
  // SPECIALIST: tomar consulta y responder
  // --------------------------------------------------------------------------
  @Roles(UserRole.SPECIALIST)
  @Post(':id/assign-to-me')
  @ApiOperation({ summary: 'Asignarse esta consulta' })
  assignToMe(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.questionsService.assignToMe(user.sub, user.role, id);
  }

  @Roles(UserRole.SPECIALIST)
  @Post(':id/answer')
  @ApiOperation({ summary: 'Responder a una consulta' })
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateAnswerDto,
    @ClientIp() ip: string,
  ) {
    return this.questionsService.answer(user.sub, user.role, id, dto, ip);
  }

  // --------------------------------------------------------------------------
  // PARENT: cerrar / aceptar respuesta
  // --------------------------------------------------------------------------
  @Roles(UserRole.PARENT)
  @Patch(':id/close')
  @ApiOperation({ summary: 'Cerrar consulta' })
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.questionsService.close(user.sub, user.role, id);
  }

  @Roles(UserRole.PARENT)
  @Patch('answers/:answerId/accept')
  @ApiOperation({ summary: 'Marcar respuesta como aceptada' })
  acceptAnswer(@CurrentUser() user: AuthUser, @Param('answerId') answerId: string) {
    return this.questionsService.acceptAnswer(user.sub, user.role, answerId);
  }
}
