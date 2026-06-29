// ============================================================================
// MchatController
// ============================================================================

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { MchatService } from './mchat.service';
import { SubmitMchatDto } from './dto/mchat.dto';
import { Public, CurrentUser, AuthUser, ClientIp, Roles } from '../common/decorators';

@ApiTags('M-CHAT-R')
@Controller('mchat')
export class MchatController {
  constructor(private readonly mchatService: MchatService) {}

  // --------------------------------------------------------------------------
  // GET /mchat/questions — públicas (cualquiera puede leer las preguntas)
  // --------------------------------------------------------------------------
  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Obtener las 20 preguntas del M-CHAT-R' })
  getQuestions() {
    return this.mchatService.getQuestions();
  }

  // --------------------------------------------------------------------------
  // POST /mchat — Submit (solo PARENT)
  // --------------------------------------------------------------------------
  @Roles(UserRole.PARENT)
  @Post()
  @ApiOperation({ summary: 'Enviar respuestas y obtener resultado' })
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitMchatDto,
    @ClientIp() ip: string,
  ) {
    return this.mchatService.submit(user.sub, user.role, dto, ip);
  }

  // --------------------------------------------------------------------------
  // GET /mchat/history — Historial propio del padre
  // --------------------------------------------------------------------------
  @Roles(UserRole.PARENT)
  @Get('history')
  @ApiOperation({ summary: 'Historial de evaluaciones del padre' })
  history(@CurrentUser() user: AuthUser) {
    return this.mchatService.getMyHistory(user.sub, user.role);
  }

  // --------------------------------------------------------------------------
  // GET /mchat/:id — Detalle de una evaluación (RLS la protege)
  // --------------------------------------------------------------------------
  @Roles(UserRole.PARENT)
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una evaluación' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mchatService.getOne(user.sub, user.role, id);
  }
}
