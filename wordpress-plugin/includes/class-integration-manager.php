<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Integration_Manager {
    public static function generate( string $prompt ): string {
        return get_option( 'scalz_seo_ai_provider', 'openai' ) === 'ai_engine' ? self::via_ai_engine( $prompt ) : self::via_openai( $prompt );
    }
    private static function via_openai( string $prompt ): string {
        $key = get_option( 'scalz_seo_openai_api_key', '' ); if ( empty( $key ) ) return '';
        $r = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [ 'headers' => [ 'Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json' ], 'body' => wp_json_encode( [ 'model' => get_option( 'scalz_seo_openai_model', 'gpt-4o' ), 'messages' => [ [ 'role' => 'system', 'content' => 'You are an expert SEO and content writer specializing in local business optimization.' ], [ 'role' => 'user', 'content' => $prompt ] ], 'temperature' => (float) get_option( 'scalz_seo_ai_temperature', 0.7 ), 'max_tokens' => 4000 ] ), 'timeout' => 60 ] );
        if ( is_wp_error( $r ) ) return '';
        return json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '';
    }
    private static function via_ai_engine( string $prompt ): string {
        if ( function_exists( 'mwai_ask_ai_async' ) ) { $result = ''; mwai_ask_ai_async( $prompt, function( $reply ) use ( &$result ) { $result = $reply; } ); return $result; }
        if ( class_exists( 'Meow_MWAI_Core' ) ) { $core = Meow_MWAI_Core::get_instance(); if ( method_exists( $core, 'run_completion' ) ) { try { return (string) $core->run_completion( $prompt ); } catch ( Exception $e ) { return ''; } } }
        if ( function_exists( 'mwai_chat_completion' ) ) { try { return mwai_chat_completion( [ [ 'role' => 'user', 'content' => $prompt ] ] )['choices'][0]['message']['content'] ?? ''; } catch ( Exception $e ) { return ''; } }
        return '';
    }
    public static function test_connection(): array {
        $provider = get_option( 'scalz_seo_ai_provider', 'openai' );
        if ( $provider === 'ai_engine' ) {
            $ok = function_exists( 'mwai_ask_ai_async' ) || class_exists( 'Meow_MWAI_Core' ) || function_exists( 'mwai_chat_completion' );
            return [ 'success' => $ok, 'provider' => 'AI Engine', 'message' => $ok ? 'AI Engine is available' : 'AI Engine plugin not found' ];
        }
        $key = get_option( 'scalz_seo_openai_api_key', '' );
        if ( empty( $key ) ) return [ 'success' => false, 'provider' => 'OpenAI', 'message' => 'API key not configured' ];
        $r = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [ 'headers' => [ 'Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json' ], 'body' => wp_json_encode( [ 'model' => get_option( 'scalz_seo_openai_model', 'gpt-4o' ), 'messages' => [ [ 'role' => 'user', 'content' => 'Reply with the single word: ok' ] ], 'max_tokens' => 5 ] ), 'timeout' => 15 ] );
        if ( is_wp_error( $r ) ) return [ 'success' => false, 'provider' => 'OpenAI', 'message' => $r->get_error_message() ];
        $code = wp_remote_retrieve_response_code( $r ); $data = json_decode( wp_remote_retrieve_body( $r ), true );
        return $code === 200 ? [ 'success' => true, 'provider' => 'OpenAI', 'message' => 'Connected. Reply: ' . trim( $data['choices'][0]['message']['content'] ?? '' ) ] : [ 'success' => false, 'provider' => 'OpenAI', 'message' => $data['error']['message'] ?? 'HTTP ' . $code ];
    }
    public static function get_available_models(): array { return get_option( 'scalz_seo_ai_provider', 'openai' ) === 'ai_engine' ? [ 'ai-engine-default' ] : [ 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo' ]; }
}
