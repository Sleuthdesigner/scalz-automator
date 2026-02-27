<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Schema_Manager {
    public static function build_faq_schema( array $faqs ): string {
        $entities = [];
        foreach ( $faqs as $faq ) {
            if ( empty( $faq['question'] ) || empty( $faq['answer'] ) ) continue;
            $entities[] = [ '@type' => 'Question', 'name' => sanitize_text_field( $faq['question'] ), 'acceptedAnswer' => [ '@type' => 'Answer', 'text' => wp_kses_post( $faq['answer'] ) ] ];
        }
        if ( empty( $entities ) ) return '';
        return "<script type='application/ld+json'>" . wp_json_encode( [ '@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $entities ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT ) . "</script>";
    }
    public static function generate_faq( array $params ): array {
        $page_id = intval( $params['page_id'] ?? 0 ); $client = $params['client'] ?? [];
        $posts = $page_id ? [ $page_id ] : get_posts( [ 'post_type' => 'page', 'post_status' => 'publish', 'posts_per_page' => -1, 'fields' => 'ids' ] );
        if ( ! class_exists( 'Scalz_Integration_Manager' ) ) return [ 'error' => 'Integration Manager not available' ];
        $updated = $errors = 0; $results = [];
        foreach ( $posts as $pid ) {
            $title = get_the_title( $pid ); $fk = get_post_meta( $pid, 'rank_math_focus_keyword', true ) ?: $title;
            $loc = trim( ( $client['city'] ?? '' ) . ', ' . ( $client['state'] ?? '' ) ); $svc = $client['services'] ?? $client['niche'] ?? '';
            $tpl = get_option( 'scalz_seo_prompt_faq', '' );
            $prompt = str_replace( [ '{service}', '{location}', '{business_name}', '{title}', '{focus_keyword}' ], [ is_array( $svc ) ? implode( ', ', $svc ) : $svc, $loc, $client['business_name'] ?? '', $title, $fk ], $tpl );
            $raw = Scalz_Integration_Manager::generate( $prompt ); $faqs = null;
            if ( preg_match( '/\[.*\]/s', $raw, $m ) ) { $faqs = json_decode( $m[0], true ); }
            if ( ! $faqs || ! is_array( $faqs ) ) { $errors++; $results[] = [ 'id' => $pid, 'status' => 'error', 'reason' => 'Could not parse FAQ JSON' ]; continue; }
            $schema = self::build_faq_schema( $faqs );
            if ( ! $schema ) { $errors++; $results[] = [ 'id' => $pid, 'status' => 'error', 'reason' => 'Empty schema' ]; continue; }
            wp_update_post( [ 'ID' => $pid, 'post_content' => get_post_field( 'post_content', $pid ) . $schema ] );
            $updated++; $results[] = [ 'id' => $pid, 'faqs' => count( $faqs ), 'status' => 'updated' ];
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
}
